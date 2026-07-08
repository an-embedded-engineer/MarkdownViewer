use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
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

struct PlantUmlRuntimeOptions {
    jar_path: PathBuf,
    _config_path: Option<PathBuf>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentFolderEntry {
    path: String,
    name: String,
    last_opened_at: String,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    recent_folders: Vec<RecentFolderEntry>,
}

#[derive(Default)]
struct AppConfigStore {
    lock: Mutex<()>,
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
const APP_CONFIG_FILE_NAME: &str = "settings.json";
const MAX_RECENT_FOLDERS: usize = 10;

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
async fn render_plantuml_diagrams(sources: Vec<String>) -> Result<PlantUmlRenderResponse, String> {
    tauri::async_runtime::spawn_blocking(move || render_plantuml_diagrams_blocking(sources))
        .await
        .map_err(|error| format!("PlantUML render task failed: {error}"))?
}

#[tauri::command]
fn load_recent_folders(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
) -> Result<Vec<RecentFolderEntry>, String> {
    let _guard = store
        .lock
        .lock()
        .map_err(|_| "Failed to lock app config store.".to_string())?;
    Ok(read_app_config(&app)?.recent_folders)
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

    let _guard = store
        .lock
        .lock()
        .map_err(|_| "Failed to lock app config store.".to_string())?;
    let mut config = read_app_config(&app)?;
    let canonical_path_text = path_to_string(&canonical_path);
    config
        .recent_folders
        .retain(|entry| entry.path != canonical_path_text);
    config.recent_folders.insert(
        0,
        RecentFolderEntry {
            path: canonical_path_text,
            name: recent_folder_name(&canonical_path),
            last_opened_at: current_unix_seconds(),
        },
    );
    config.recent_folders.truncate(MAX_RECENT_FOLDERS);
    write_app_config(&app, &config)?;
    Ok(config.recent_folders)
}

#[tauri::command]
fn remove_recent_folder(
    app: tauri::AppHandle,
    store: State<'_, AppConfigStore>,
    path: String,
) -> Result<Vec<RecentFolderEntry>, String> {
    let _guard = store
        .lock
        .lock()
        .map_err(|_| "Failed to lock app config store.".to_string())?;
    let mut config = read_app_config(&app)?;
    config.recent_folders.retain(|entry| entry.path != path);
    write_app_config(&app, &config)?;
    Ok(config.recent_folders)
}

fn render_plantuml_diagrams_blocking(
    sources: Vec<String>,
) -> Result<PlantUmlRenderResponse, String> {
    let mut diagrams = Vec::with_capacity(sources.len());
    let mut first_error = None;

    for source in sources {
        let result = render_plantuml_diagram(&source);
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

fn write_app_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let config_path = app_config_path(app)?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create app config directory: {error}"))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Failed to serialize app config: {error}"))?;
    fs::write(&config_path, content)
        .map_err(|error| format!("Failed to write app config: {error}"))
}

fn app_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(APP_CONFIG_FILE_NAME))
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))
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
    path.to_string_lossy().to_string()
}

fn render_plantuml_diagram(source: &str) -> PlantUmlDiagramResult {
    match render_plantuml_svg(source) {
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

fn render_plantuml_svg(source: &str) -> Result<String, String> {
    let runtime = resolve_plantuml_runtime()?;
    let mut child = Command::new("java")
        .arg("-jar")
        .arg(&runtime.jar_path)
        .arg("-tsvg")
        .arg("-pipe")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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

fn resolve_plantuml_runtime() -> Result<PlantUmlRuntimeOptions, String> {
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

    Err("PlantUML runtime is not configured. Place plantuml.jar next to the executable or set plantUmlJarPath in plantuml.config.json.".into())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppConfigStore::default())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            read_text_file,
            render_plantuml_diagrams,
            load_recent_folders,
            record_recent_folder,
            remove_recent_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
