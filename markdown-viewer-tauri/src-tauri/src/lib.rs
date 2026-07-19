use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileTreeNode {
    name: String,
    path: String,
    relative_path: String,
    node_type: FileNodeType,
    children: Vec<FileTreeNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PlantUmlRenderResponse {
    diagrams: Vec<PlantUmlDiagramResult>,
    first_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PlantUmlDiagramResult {
    ok: bool,
    html: String,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlantUmlRuntimeConfig {
    plant_uml_jar_path: Option<String>,
}

#[derive(Debug)]
struct PlantUmlRuntimeOptions {
    jar_path: PathBuf,
    _config_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentFolderEntry {
    path: String,
    name: String,
    last_opened_at: String,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum AppTheme {
    Light,
    Dark,
}

impl Default for AppTheme {
    fn default() -> Self {
        Self::Light
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct WindowSize {
    width: u32,
    height: u32,
}

impl Default for WindowSize {
    fn default() -> Self {
        Self {
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct ViewerSettings {
    theme: AppTheme,
    window_size: WindowSize,
    plant_uml_jar_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ViewerSettingsLoadResult {
    settings: ViewerSettings,
    warnings: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct AppConfig {
    recent_folders: Vec<RecentFolderEntry>,
    viewer_settings: ViewerSettings,
}

struct AppConfigStore {
    lock: Mutex<()>,
    temp_sequence: AtomicU64,
}

impl Default for AppConfigStore {
    fn default() -> Self {
        Self {
            lock: Mutex::new(()),
            temp_sequence: AtomicU64::new(1),
        }
    }
}

impl AppConfigStore {
    fn load(&self, app: &tauri::AppHandle) -> Result<AppConfig, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Failed to lock app config store.".to_string())?;
        read_app_config(app)
    }

    fn update<T>(
        &self,
        app: &tauri::AppHandle,
        updater: impl FnOnce(&mut AppConfig) -> Result<T, String>,
    ) -> Result<T, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Failed to lock app config store.".to_string())?;
        let mut config = read_app_config(app)?;
        let result = updater(&mut config)?;
        let sequence = self.temp_sequence.fetch_add(1, Ordering::Relaxed);
        write_app_config(app, &config, sequence)?;
        Ok(result)
    }

    fn viewer_settings(&self, app: &tauri::AppHandle) -> Result<ViewerSettingsLoadResult, String> {
        let config = self.load(app)?;
        Ok(normalize_viewer_settings(&config.viewer_settings))
    }

    fn plantuml_runtime(&self, app: &tauri::AppHandle) -> Result<PlantUmlRuntimeOptions, String> {
        let config = self.load(app)?;
        resolve_plantuml_runtime(config.viewer_settings.plant_uml_jar_path.as_deref())
    }
}

#[derive(Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
enum FileNodeType {
    Directory,
    Markdown,
    Image,
}

const SKIPPED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "bin",
    "obj",
    "target",
    ".venv",
    "__pycache__",
];

const PLANTUML_CONFIG_FILE_NAME: &str = "plantuml.config.json";
const PLANTUML_JAR_FILE_NAME: &str = "plantuml.jar";
const PLANTUML_RENDER_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const APP_CONFIG_FILE_NAME: &str = "settings.json";
const MAX_RECENT_FOLDERS: usize = 10;
const DEFAULT_WINDOW_WIDTH: u32 = 800;
const DEFAULT_WINDOW_HEIGHT: u32 = 600;
const MIN_WINDOW_WIDTH: u32 = 640;
const MIN_WINDOW_HEIGHT: u32 = 480;
const MAX_WINDOW_DIMENSION: u32 = 10_000;

#[tauri::command]
fn scan_directory(root_path: String) -> Result<FileTreeNode, String> {
    let root = normalize_path(PathBuf::from(root_path))?;
    if !root.is_dir() {
        return Err("Selected path is not a directory.".into());
    }

    build_tree(&root, &root)
}

#[tauri::command]
fn read_text_file(root_path: String, path: String) -> Result<String, String> {
    let root = normalize_path(PathBuf::from(root_path))?;
    let file_path = normalize_path(PathBuf::from(path))?;

    if !file_path.starts_with(&root) {
        return Err("File is outside the selected root directory.".into());
    }

    if !is_markdown_path(&file_path) {
        return Err("Selected file is not a Markdown file.".into());
    }

    fs::read_to_string(&file_path).map_err(|error| format!("Failed to read file: {error}"))
}

#[tauri::command]
async fn render_plantuml_diagrams(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    sources: Vec<String>,
) -> Result<PlantUmlRenderResponse, String> {
    let runtime = store.plantuml_runtime(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        render_plantuml_diagrams_blocking(sources, runtime)
    })
    .await
    .map_err(|error| format!("PlantUML render task failed: {error}"))?
}

#[tauri::command]
fn load_viewer_settings(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
) -> Result<ViewerSettingsLoadResult, String> {
    store.viewer_settings(&app)
}

#[tauri::command]
fn save_viewer_preferences(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    theme: AppTheme,
    plant_uml_jar_path: Option<String>,
) -> Result<ViewerSettingsLoadResult, String> {
    let normalized_path = normalize_configured_plantuml_path(plant_uml_jar_path)?;
    let settings = store.update(&app, |config| {
        config.viewer_settings.theme = theme;
        config.viewer_settings.plant_uml_jar_path = normalized_path;
        Ok(config.viewer_settings.clone())
    })?;
    Ok(normalize_viewer_settings(&settings))
}

#[tauri::command]
fn save_window_size(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    width: u32,
    height: u32,
) -> Result<WindowSize, String> {
    let size = WindowSize { width, height };
    validate_window_size(size)?;
    store.update(&app, |config| {
        config.viewer_settings.window_size = size;
        Ok(size)
    })
}

#[tauri::command]
fn load_recent_folders(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
) -> Result<Vec<RecentFolderEntry>, String> {
    Ok(store.load(&app)?.recent_folders)
}

#[tauri::command]
fn record_recent_folder(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    path: String,
) -> Result<Vec<RecentFolderEntry>, String> {
    let canonical_path = normalize_path(PathBuf::from(path))?;
    if !canonical_path.is_dir() {
        return Err("Selected path is not a directory.".into());
    }

    let canonical_path_text = path_to_string(&canonical_path);
    let folder_name = recent_folder_name(&canonical_path);
    store.update(&app, |config| {
        config
            .recent_folders
            .retain(|entry| entry.path != canonical_path_text);
        config.recent_folders.insert(
            0,
            RecentFolderEntry {
                path: canonical_path_text,
                name: folder_name,
                last_opened_at: current_unix_seconds(),
            },
        );
        config.recent_folders.truncate(MAX_RECENT_FOLDERS);
        Ok(config.recent_folders.clone())
    })
}

#[tauri::command]
fn remove_recent_folder(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    path: String,
) -> Result<Vec<RecentFolderEntry>, String> {
    store.update(&app, |config| {
        config.recent_folders.retain(|entry| entry.path != path);
        Ok(config.recent_folders.clone())
    })
}

fn render_plantuml_diagrams_blocking(
    sources: Vec<String>,
    runtime: PlantUmlRuntimeOptions,
) -> Result<PlantUmlRenderResponse, String> {
    let mut diagrams = Vec::with_capacity(sources.len());
    let mut first_error = None;

    for source in sources {
        let result = render_plantuml_diagram(&source, &runtime);
        if let Some(error) = &result.error {
            first_error.get_or_insert_with(|| error.clone());
        }
        diagrams.push(result);
    }

    Ok(PlantUmlRenderResponse {
        diagrams,
        first_error,
    })
}

fn read_app_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = app_config_path(app)?;
    if !config_path.is_file() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|error| format!("Failed to read app config: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("Failed to parse app config: {error}"))
}

fn write_app_config(
    app: &tauri::AppHandle,
    config: &AppConfig,
    sequence: u64,
) -> Result<(), String> {
    let config_path = app_config_path(app)?;
    write_app_config_to_path(&config_path, config, sequence)
}

fn write_app_config_to_path(
    config_path: &Path,
    config: &AppConfig,
    sequence: u64,
) -> Result<(), String> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create app config directory: {error}"))?;
    }

    let mut content = serde_json::to_vec_pretty(config)
        .map_err(|error| format!("Failed to serialize app config: {error}"))?;
    content.push(b'\n');
    let temp_path = app_config_temp_path(config_path, sequence)?;
    let write_result = (|| {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)
            .map_err(|error| format!("Failed to create temporary app config: {error}"))?;
        file.write_all(&content)
            .map_err(|error| format!("Failed to write temporary app config: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync temporary app config: {error}"))?;
        replace_app_config_file(&temp_path, config_path)?;
        sync_app_config_directory(config_path)?;
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result
}

fn app_config_temp_path(config_path: &Path, sequence: u64) -> Result<PathBuf, String> {
    let parent = config_path
        .parent()
        .ok_or_else(|| "App config path has no parent directory.".to_string())?;
    let file_name = config_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "App config file name is not valid UTF-8.".to_string())?;
    Ok(parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        sequence
    )))
}

#[cfg(windows)]
fn replace_app_config_file(source: &Path, destination: &Path) -> Result<(), String> {
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVE_FILE_REPLACE_EXISTING, MOVE_FILE_WRITE_THROUGH,
    };

    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    // SAFETY: both buffers are NUL-terminated UTF-16 paths and remain alive for the call.
    let result = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVE_FILE_REPLACE_EXISTING | MOVE_FILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err(format!(
            "Failed to replace app config: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_app_config_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination)
        .map_err(|error| format!("Failed to replace app config: {error}"))
}

#[cfg(unix)]
fn sync_app_config_directory(config_path: &Path) -> Result<(), String> {
    let parent = config_path
        .parent()
        .ok_or_else(|| "App config path has no parent directory.".to_string())?;
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Failed to sync app config directory: {error}"))
}

#[cfg(not(unix))]
fn sync_app_config_directory(_config_path: &Path) -> Result<(), String> {
    Ok(())
}

fn app_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(APP_CONFIG_FILE_NAME))
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))
}

fn normalize_viewer_settings(settings: &ViewerSettings) -> ViewerSettingsLoadResult {
    let mut normalized = settings.clone();
    let mut warnings = Vec::new();
    if let Err(error) = validate_window_size(settings.window_size) {
        normalized.window_size = WindowSize::default();
        warnings.push(format!(
            "Saved window size is invalid and was reset to {} x {}: {error}",
            DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT
        ));
    }
    ViewerSettingsLoadResult {
        settings: normalized,
        warnings,
    }
}

fn validate_window_size(size: WindowSize) -> Result<(), String> {
    if !(MIN_WINDOW_WIDTH..=MAX_WINDOW_DIMENSION).contains(&size.width) {
        return Err(format!(
            "Window width must be between {MIN_WINDOW_WIDTH} and {MAX_WINDOW_DIMENSION}."
        ));
    }
    if !(MIN_WINDOW_HEIGHT..=MAX_WINDOW_DIMENSION).contains(&size.height) {
        return Err(format!(
            "Window height must be between {MIN_WINDOW_HEIGHT} and {MAX_WINDOW_DIMENSION}."
        ));
    }
    Ok(())
}

fn normalize_configured_plantuml_path(path: Option<String>) -> Result<Option<String>, String> {
    let Some(path) = path.map(|value| value.trim().to_string()) else {
        return Ok(None);
    };
    if path.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("PlantUML jar path must be absolute.".into());
    }
    if !is_jar_path(&path) {
        return Err("PlantUML jar path must have a .jar extension.".into());
    }
    if !path.is_file() {
        return Err(format!("PlantUML jar was not found: {}", path.display()));
    }
    normalize_path(path).map(|value| Some(path_to_string(&value)))
}

fn is_jar_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("jar"))
}

fn recent_folder_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string())
}

fn current_unix_seconds() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn build_tree(path: &Path, root: &Path) -> Result<FileTreeNode, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Failed to read metadata: {error}"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string());
    let relative_path = path
        .strip_prefix(root)
        .ok()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();

    if metadata.is_dir() {
        let mut children = Vec::new();
        let entries =
            fs::read_dir(path).map_err(|error| format!("Failed to read directory: {error}"))?;

        for entry in entries {
            let entry =
                entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
            let child_path = entry.path();
            let child_name = entry.file_name().to_string_lossy().to_string();

            if child_path.is_dir() {
                if SKIPPED_DIRS.contains(&child_name.as_str()) {
                    continue;
                }
                children.push(build_tree(&child_path, root)?);
            } else if is_markdown_path(&child_path) || is_image_path(&child_path) {
                children.push(build_tree(&child_path, root)?);
            }
        }

        children.sort_by(compare_nodes);

        return Ok(FileTreeNode {
            name,
            path: path_to_string(path),
            relative_path,
            node_type: FileNodeType::Directory,
            children,
        });
    }

    let node_type = if is_markdown_path(path) {
        FileNodeType::Markdown
    } else {
        FileNodeType::Image
    };

    Ok(FileTreeNode {
        name,
        path: path_to_string(path),
        relative_path,
        node_type,
        children: Vec::new(),
    })
}

fn compare_nodes(left: &FileTreeNode, right: &FileTreeNode) -> std::cmp::Ordering {
    node_sort_rank(&left.node_type)
        .cmp(&node_sort_rank(&right.node_type))
        .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
}

fn node_sort_rank(node_type: &FileNodeType) -> u8 {
    match node_type {
        FileNodeType::Directory => 0,
        FileNodeType::Markdown => 1,
        FileNodeType::Image => 2,
    }
}

fn normalize_path(path: PathBuf) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|error| format!("Failed to resolve path: {error}"))
}

fn is_markdown_path(path: &Path) -> bool {
    extension(path).is_some_and(|ext| ext == "md" || ext == "markdown")
}

fn is_image_path(path: &Path) -> bool {
    extension(path).is_some_and(|ext| {
        matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif"
        )
    })
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn path_to_string(path: &Path) -> String {
    path_for_external_use(path).to_string_lossy().to_string()
}

fn path_for_external_use(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let value = path.to_string_lossy();
        if let Some(unc_path) = value.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{unc_path}"));
        }
        if let Some(local_path) = value.strip_prefix(r"\\?\") {
            return PathBuf::from(local_path);
        }
    }

    path.to_path_buf()
}

fn render_plantuml_diagram(
    source: &str,
    runtime: &PlantUmlRuntimeOptions,
) -> PlantUmlDiagramResult {
    match render_plantuml_svg(source, runtime) {
        Ok(svg) => PlantUmlDiagramResult {
            ok: true,
            html: format!(
                r#"<div class="plantuml-diagram">{}</div>"#,
                sanitize_svg(&svg)
            ),
            error: None,
        },
        Err(error) => PlantUmlDiagramResult {
            ok: false,
            html: plantuml_error_html(&error),
            error: Some(format!("PlantUML render failed: {error}")),
        },
    }
}

fn render_plantuml_svg(source: &str, runtime: &PlantUmlRuntimeOptions) -> Result<String, String> {
    let mut command = Command::new("java");
    command
        .arg("-jar")
        .arg(path_for_external_use(&runtime.jar_path))
        .arg("-tsvg")
        .arg("-pipe")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start Java: {error}"))?;

    let mut stdout_reader = Some(
        child
            .stdout
            .take()
            .map(|output| read_plantuml_pipe(output, "stdout"))
            .ok_or_else(|| "Failed to open PlantUML stdout.".to_string())?,
    );
    let mut stderr_reader = Some(
        child
            .stderr
            .take()
            .map(|output| read_plantuml_pipe(output, "stderr"))
            .ok_or_else(|| "Failed to open PlantUML stderr.".to_string())?,
    );

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "Failed to open PlantUML stdin.".to_string())?;
        if let Err(error) = stdin.write_all(normalize_plantuml_source(source).as_bytes()) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = join_plantuml_pipe(&mut stdout_reader);
            let _ = join_plantuml_pipe(&mut stderr_reader);
            return Err(format!("Failed to write PlantUML source: {error}"));
        }
    }
    drop(child.stdin.take());

    let started = Instant::now();
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Failed to wait for PlantUML: {error}"))?
        {
            let stdout = join_plantuml_pipe(&mut stdout_reader)?;
            let stderr = join_plantuml_pipe(&mut stderr_reader)?;

            if !status.success() {
                let error = String::from_utf8_lossy(&stderr).trim().to_string();
                return Err(if error.is_empty() {
                    format!("PlantUML exited with status {status}.")
                } else {
                    error
                });
            }

            let svg = String::from_utf8_lossy(&stdout).to_string();
            if svg.trim().is_empty() {
                return Err("PlantUML produced empty SVG output.".into());
            }
            return Ok(svg);
        }

        if started.elapsed() >= PLANTUML_RENDER_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = join_plantuml_pipe(&mut stdout_reader);
            let _ = join_plantuml_pipe(&mut stderr_reader);
            return Err("PlantUML render timed out.".into());
        }

        std::thread::sleep(Duration::from_millis(20));
    }
}

fn read_plantuml_pipe<R>(
    mut output: R,
    stream_name: &'static str,
) -> thread::JoinHandle<Result<Vec<u8>, String>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = Vec::new();
        output
            .read_to_end(&mut buffer)
            .map_err(|error| format!("Failed to read PlantUML {stream_name}: {error}"))?;
        Ok(buffer)
    })
}

fn join_plantuml_pipe(
    reader: &mut Option<thread::JoinHandle<Result<Vec<u8>, String>>>,
) -> Result<Vec<u8>, String> {
    let reader = reader
        .take()
        .ok_or_else(|| "PlantUML output reader was already consumed.".to_string())?;
    reader
        .join()
        .map_err(|_| "Failed to read PlantUML output: reader thread panicked.".to_string())?
}

fn resolve_plantuml_runtime(
    configured_jar_path: Option<&str>,
) -> Result<PlantUmlRuntimeOptions, String> {
    if let Some(configured_jar_path) = configured_jar_path {
        return resolve_configured_plantuml_runtime(configured_jar_path);
    }

    for directory in plantuml_runtime_directories()? {
        let config_path = directory.join(PLANTUML_CONFIG_FILE_NAME);
        if config_path.is_file() {
            return resolve_plantuml_runtime_from_config(&config_path);
        }

        let jar_path = directory.join(PLANTUML_JAR_FILE_NAME);
        if jar_path.is_file() {
            return Ok(PlantUmlRuntimeOptions {
                jar_path: normalize_path(jar_path)?,
                _config_path: None,
            });
        }
    }

    Err("PlantUML runtime is not configured. Choose plantuml.jar in File > Settings, place it next to the executable, or set plantUmlJarPath in plantuml.config.json.".into())
}

fn resolve_configured_plantuml_runtime(
    configured_jar_path: &str,
) -> Result<PlantUmlRuntimeOptions, String> {
    let jar_path = PathBuf::from(configured_jar_path);
    if !jar_path.is_absolute() {
        return Err("Configured PlantUML jar path must be absolute.".into());
    }
    if !is_jar_path(&jar_path) {
        return Err("Configured PlantUML jar path must have a .jar extension.".into());
    }
    if !jar_path.is_file() {
        return Err(format!(
            "Configured PlantUML jar was not found: {}",
            jar_path.display()
        ));
    }
    Ok(PlantUmlRuntimeOptions {
        jar_path: normalize_path(jar_path)?,
        _config_path: None,
    })
}

fn resolve_plantuml_runtime_from_config(
    config_path: &Path,
) -> Result<PlantUmlRuntimeOptions, String> {
    let content = fs::read_to_string(config_path)
        .map_err(|error| format!("Failed to read PlantUML config: {error}"))?;
    let config: PlantUmlRuntimeConfig = serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse PlantUML config: {error}"))?;
    let jar_path = config
        .plant_uml_jar_path
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| "PlantUML config must contain plantUmlJarPath.".to_string())?;
    let jar_path = PathBuf::from(jar_path);
    let jar_path = if jar_path.is_absolute() {
        jar_path
    } else {
        config_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(jar_path)
    };

    if !jar_path.is_file() {
        return Err(format!(
            "PlantUML jar was not found: {}",
            jar_path.display()
        ));
    }

    Ok(PlantUmlRuntimeOptions {
        jar_path: normalize_path(jar_path)?,
        _config_path: Some(normalize_path(config_path.to_path_buf())?),
    })
}

fn plantuml_runtime_directories() -> Result<Vec<PathBuf>, String> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));

    if let Some(directory) = &exe_dir {
        if is_macos_app_executable_directory(directory) {
            return Ok(vec![normalize_path(directory.clone())?]);
        }
    }

    let mut directories = Vec::new();

    #[cfg(debug_assertions)]
    directories.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));

    if let Ok(current_dir) = std::env::current_dir() {
        directories.push(current_dir);
    }

    if let Some(directory) = exe_dir {
        directories.push(directory);
    }

    let mut normalized = Vec::new();
    for directory in directories {
        if let Ok(path) = normalize_path(directory) {
            if !normalized.contains(&path) {
                normalized.push(path);
            }
        }
    }
    Ok(normalized)
}

fn is_macos_app_executable_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name == "MacOS")
        && path
            .parent()
            .and_then(|value| value.file_name())
            .and_then(|value| value.to_str())
            .is_some_and(|name| name == "Contents")
}

fn normalize_plantuml_source(source: &str) -> String {
    let trimmed = source.trim();
    if contains_plantuml_start(trimmed) && contains_plantuml_end(trimmed) {
        return trimmed.to_string();
    }

    format!("@startuml\n{trimmed}\n@enduml")
}

fn contains_plantuml_start(source: &str) -> bool {
    source
        .lines()
        .any(|line| line.trim_start().to_ascii_lowercase().starts_with("@start"))
}

fn contains_plantuml_end(source: &str) -> bool {
    source
        .lines()
        .any(|line| line.trim_start().to_ascii_lowercase().starts_with("@end"))
}

fn sanitize_svg(svg: &str) -> String {
    remove_event_handler_attributes(&remove_script_elements(svg))
}

fn remove_script_elements(value: &str) -> String {
    let mut remaining = value;
    let mut output = String::with_capacity(value.len());

    loop {
        let lower = remaining.to_ascii_lowercase();
        let Some(start) = lower.find("<script") else {
            output.push_str(remaining);
            return output;
        };

        output.push_str(&remaining[..start]);
        let Some(end) = lower[start..].find("</script>") else {
            return output;
        };
        remaining = &remaining[start + end + "</script>".len()..];
    }
}

fn remove_event_handler_attributes(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index].is_ascii_whitespace()
            && index + 2 < bytes.len()
            && (bytes[index + 1] == b'o' || bytes[index + 1] == b'O')
            && (bytes[index + 2] == b'n' || bytes[index + 2] == b'N')
        {
            let mut cursor = index + 3;
            while cursor < bytes.len()
                && (bytes[cursor].is_ascii_alphanumeric() || bytes[cursor] == b'-')
            {
                cursor += 1;
            }
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor < bytes.len() && bytes[cursor] == b'=' {
                cursor += 1;
                while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                    cursor += 1;
                }
                if cursor < bytes.len() && (bytes[cursor] == b'"' || bytes[cursor] == b'\'') {
                    let quote = bytes[cursor];
                    cursor += 1;
                    while cursor < bytes.len() && bytes[cursor] != quote {
                        cursor += 1;
                    }
                    if cursor < bytes.len() {
                        index = cursor + 1;
                        continue;
                    }
                }
            }
        }

        let Some(character) = value[index..].chars().next() else {
            break;
        };
        output.push(character);
        index += character.len_utf8();
    }

    output
}

fn plantuml_error_html(message: &str) -> String {
    format!(
        r#"<pre class="plantuml-error">PlantUML render failed: {}</pre>"#,
        escape_html(message)
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "markdown-viewer-{name}-{}-{suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test directory must be created");
        directory
    }

    #[test]
    fn legacy_config_defaults_viewer_settings() {
        let config: AppConfig = serde_json::from_str(
            r#"{"recentFolders":[{"path":"/docs","name":"docs","lastOpenedAt":"1"}]}"#,
        )
        .expect("legacy config must deserialize");

        assert_eq!(config.recent_folders.len(), 1);
        assert_eq!(config.viewer_settings, ViewerSettings::default());
    }

    #[test]
    fn invalid_window_size_preserves_other_settings_and_returns_warning() {
        let settings = ViewerSettings {
            theme: AppTheme::Dark,
            window_size: WindowSize {
                width: 320,
                height: 200,
            },
            plant_uml_jar_path: Some("/tmp/plantuml.jar".into()),
        };

        let result = normalize_viewer_settings(&settings);

        assert_eq!(result.settings.theme, AppTheme::Dark);
        assert_eq!(result.settings.window_size, WindowSize::default());
        assert_eq!(
            result.settings.plant_uml_jar_path.as_deref(),
            Some("/tmp/plantuml.jar")
        );
        assert_eq!(result.warnings.len(), 1);
    }

    #[test]
    fn window_size_validation_accepts_boundaries() {
        assert!(validate_window_size(WindowSize {
            width: MIN_WINDOW_WIDTH,
            height: MIN_WINDOW_HEIGHT,
        })
        .is_ok());
        assert!(validate_window_size(WindowSize {
            width: MAX_WINDOW_DIMENSION,
            height: MAX_WINDOW_DIMENSION,
        })
        .is_ok());
        assert!(validate_window_size(WindowSize {
            width: MIN_WINDOW_WIDTH - 1,
            height: MIN_WINDOW_HEIGHT,
        })
        .is_err());
    }

    #[test]
    fn jar_extension_is_ascii_case_insensitive() {
        assert!(is_jar_path(Path::new("plantuml.jar")));
        assert!(is_jar_path(Path::new("PLANTUML.JAR")));
        assert!(!is_jar_path(Path::new("plantuml.zip")));
    }

    #[test]
    fn atomic_config_write_replaces_complete_document() {
        let directory = test_directory("atomic-config");
        let config_path = directory.join(APP_CONFIG_FILE_NAME);
        fs::write(&config_path, "old content").expect("old config must be written");
        let config = AppConfig {
            viewer_settings: ViewerSettings {
                theme: AppTheme::Dark,
                ..ViewerSettings::default()
            },
            ..AppConfig::default()
        };

        write_app_config_to_path(&config_path, &config, 1)
            .expect("atomic config write must succeed");
        let stored: AppConfig = serde_json::from_str(
            &fs::read_to_string(&config_path).expect("new config must be readable"),
        )
        .expect("new config must be complete JSON");

        assert_eq!(stored, config);
        fs::remove_file(&config_path).expect("test config must be removed");
        fs::remove_dir(&directory).expect("test directory must be removed");
    }

    #[test]
    fn atomic_config_write_failure_preserves_existing_document() {
        let directory = test_directory("atomic-config-failure");
        let config_path = directory.join(APP_CONFIG_FILE_NAME);
        let old_config = AppConfig::default();
        fs::write(
            &config_path,
            serde_json::to_vec_pretty(&old_config).expect("old config must serialize"),
        )
        .expect("old config must be written");
        let temp_path = app_config_temp_path(&config_path, 1).expect("temp path must resolve");
        fs::write(&temp_path, "collision").expect("collision file must be written");
        let new_config = AppConfig {
            viewer_settings: ViewerSettings {
                theme: AppTheme::Dark,
                ..ViewerSettings::default()
            },
            ..AppConfig::default()
        };

        assert!(write_app_config_to_path(&config_path, &new_config, 1).is_err());
        let stored: AppConfig = serde_json::from_str(
            &fs::read_to_string(&config_path).expect("old config must remain readable"),
        )
        .expect("old config must remain complete JSON");

        assert_eq!(stored, old_config);
        fs::remove_file(&config_path).expect("test config must be removed");
        fs::remove_dir(&directory).expect("test directory must be removed");
    }

    #[test]
    fn invalid_explicit_plantuml_path_does_not_use_automatic_discovery() {
        let directory = test_directory("missing-explicit-jar");
        let configured_path = directory.join("missing.jar");

        let error = resolve_plantuml_runtime(Some(
            configured_path
                .to_str()
                .expect("test path must be valid UTF-8"),
        ))
        .expect_err("missing explicit jar must fail");

        assert!(error.contains("Configured PlantUML jar was not found"));
        fs::remove_dir(&directory).expect("test directory must be removed");
    }

    #[test]
    fn ordinary_path_is_unchanged_for_external_use() {
        let path = Path::new("docs/sample.md");
        assert_eq!(path_for_external_use(path), path);
    }

    #[cfg(windows)]
    #[test]
    fn windows_verbatim_disk_prefix_is_removed_for_external_use() {
        let path = Path::new(r"\\?\D:\docs\sample.md");
        assert_eq!(
            path_for_external_use(path),
            PathBuf::from(r"D:\docs\sample.md")
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_verbatim_unc_prefix_is_converted_for_external_use() {
        let path = Path::new(r"\\?\UNC\server\share\sample.md");
        assert_eq!(
            path_for_external_use(path),
            PathBuf::from(r"\\server\share\sample.md")
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppConfigStore::default())
        .setup(|app| {
            let store = app.state::<AppConfigStore>();
            match store.viewer_settings(app.handle()) {
                Ok(result) => {
                    for warning in result.warnings {
                        eprintln!("Viewer settings warning: {warning}");
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        let size = result.settings.window_size;
                        if let Err(error) = window.set_size(tauri::LogicalSize::new(
                            size.width as f64,
                            size.height as f64,
                        )) {
                            eprintln!("Failed to restore window size: {error}");
                        }
                    }
                }
                Err(error) => eprintln!("Failed to load viewer settings: {error}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            read_text_file,
            render_plantuml_diagrams,
            load_viewer_settings,
            save_viewer_preferences,
            save_window_size,
            load_recent_folders,
            record_recent_folder,
            remove_recent_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
