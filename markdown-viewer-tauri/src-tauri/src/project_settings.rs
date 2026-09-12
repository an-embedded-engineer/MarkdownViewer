use super::*;
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ViewerError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_path: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("mv-settings-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&root).unwrap();
            Self(root)
        }
        fn repo(&self) -> SettingsRepository {
            SettingsRepository::new(self.0.join("config"))
        }
        fn project(&self, name: &str) -> PathBuf {
            let path = self.0.join(name);
            fs::create_dir_all(&path).unwrap();
            path.canonicalize().unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn migration_defaults_and_project_settings_are_independent() {
        let f = Fixture::new();
        let repo = f.repo();
        fs::create_dir_all(&repo.directory).unwrap();
        fs::write(repo.directory.join(APP_CONFIG_FILE_NAME), r#"{"viewerSettings":{"theme":"dark"},"recentFolders":[{"name":"docs","path":"/docs","lastOpenedAt":"1"}]}"#).unwrap();
        let a = f.project("a/docs");
        let b = f.project("b/docs");
        assert_eq!(repo.open_project(&a).unwrap().theme, AppTheme::Dark);
        repo.patch(
            Some(&a),
            SettingsPatch {
                theme: PatchField::Set(AppTheme::Light),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(repo.open_project(&b).unwrap().theme, AppTheme::Dark);
        assert_eq!(repo.load(Some(&a)).unwrap().theme, AppTheme::Light);
        assert_eq!(repo.recent().unwrap().len(), 1);
        assert_eq!(
            SettingsRepository::read_json(&repo.directory.join(APP_CONFIG_FILE_NAME)).unwrap()
                ["schemaVersion"]
                .as_u64()
                .unwrap(),
            2
        );
        assert_ne!(
            SettingsRepository::project_id(&a).unwrap(),
            SettingsRepository::project_id(&b).unwrap()
        );
    }
    #[test]
    fn corrupt_global_does_not_block_existing_project_and_missing_project_is_not_silently_recreated(
    ) {
        let f = Fixture::new();
        let repo = f.repo();
        let a = f.project("a");
        let b = f.project("b");
        repo.open_project(&a).unwrap();
        fs::write(repo.directory.join(APP_CONFIG_FILE_NAME), "broken").unwrap();
        assert!(repo.open_project(&a).is_ok());
        assert_eq!(repo.open_project(&b).unwrap_err().code, "invalidConfig");
        let path = repo.project_path(&a).unwrap();
        fs::remove_file(&path).unwrap();
        assert_eq!(
            repo.patch(Some(&a), SettingsPatch::default())
                .unwrap_err()
                .code,
            "missingConfig"
        );
        assert!(!path.exists());
    }

    #[test]
    fn unknown_schema_and_wrong_root_are_preserved() {
        let f = Fixture::new();
        let repo = f.repo();
        let root = f.project("root");
        repo.open_project(&root).unwrap();
        let path = repo.project_path(&root).unwrap();
        for content in [
            r#"{"schemaVersion":99,"rootPath":"wrong"}"#,
            r#"{"schemaVersion":1,"rootPath":"wrong"}"#,
        ] {
            fs::write(&path, content).unwrap();
            assert_eq!(repo.load(Some(&root)).unwrap_err().code, "invalidConfig");
            assert_eq!(fs::read_to_string(&path).unwrap(), content);
        }
    }

    #[test]
    fn settings_worker() {
        let Ok(directory) = std::env::var("MV_SETTINGS_TEST_DIR") else {
            return;
        };
        let directory = PathBuf::from(directory);
        let role = std::env::var("MV_SETTINGS_TEST_ROLE").unwrap();
        let repo = SettingsRepository::new(directory.join("config"));
        let root = directory.join("project").canonicalize().unwrap();
        if role == "hold-lock" {
            let _guard = ConfigFileLock::acquire(&repo.project_path(&root).unwrap()).unwrap();
            fs::write(directory.join("ready-hold-lock"), "ready").unwrap();
            thread::sleep(Duration::from_secs(30));
            return;
        }
        fs::write(directory.join(format!("ready-{role}")), "ready").unwrap();
        let start = Instant::now();
        while !directory.join("go").exists() {
            assert!(start.elapsed() < Duration::from_secs(10));
            thread::sleep(Duration::from_millis(5));
        }
        for _ in 0..20 {
            let patch = if role == "theme" {
                SettingsPatch {
                    theme: PatchField::Set(AppTheme::Dark),
                    ..Default::default()
                }
            } else {
                SettingsPatch {
                    window_size: PatchField::Set(WindowSize {
                        width: 1234,
                        height: 765,
                    }),
                    ..Default::default()
                }
            };
            repo.patch(Some(&root), patch).unwrap();
            repo.record_recent(directory.join(&role).to_string_lossy().into_owned())
                .unwrap();
        }
    }

    struct Worker(std::process::Child);
    impl Worker {
        fn start(f: &Fixture, role: &str) -> Self {
            Self(
                Command::new(std::env::current_exe().unwrap())
                    .args([
                        "--exact",
                        "project_settings::tests::settings_worker",
                        "--nocapture",
                    ])
                    .env("MV_SETTINGS_TEST_DIR", &f.0)
                    .env("MV_SETTINGS_TEST_ROLE", role)
                    .stdout(Stdio::null())
                    .spawn()
                    .unwrap(),
            )
        }
        fn wait_ready(&self, f: &Fixture, role: &str) {
            let start = Instant::now();
            while !f.0.join(format!("ready-{role}")).exists() {
                assert!(start.elapsed() < Duration::from_secs(10));
                thread::sleep(Duration::from_millis(5));
            }
        }
        fn finish(&mut self) {
            let start = Instant::now();
            loop {
                if let Some(status) = self.0.try_wait().unwrap() {
                    assert!(status.success());
                    break;
                }
                assert!(start.elapsed() < Duration::from_secs(10));
                thread::sleep(Duration::from_millis(5));
            }
        }
    }
    impl Drop for Worker {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }

    #[test]
    fn independent_processes_preserve_unrelated_fields_and_recent_entries() {
        let f = Fixture::new();
        let root = f.project("project");
        f.project("theme");
        f.project("size");
        let repo = f.repo();
        repo.open_project(&root).unwrap();
        let mut theme = Worker::start(&f, "theme");
        let mut size = Worker::start(&f, "size");
        theme.wait_ready(&f, "theme");
        size.wait_ready(&f, "size");
        fs::write(f.0.join("go"), "go").unwrap();
        theme.finish();
        size.finish();
        let settings = repo.load(Some(&root)).unwrap();
        assert_eq!(settings.theme, AppTheme::Dark);
        assert_eq!(
            settings.window_size,
            WindowSize {
                width: 1234,
                height: 765
            }
        );
        assert_eq!(repo.recent().unwrap().len(), 2);
    }

    #[test]
    fn lock_timeout_is_reported_and_process_exit_releases_lock() {
        let f = Fixture::new();
        let root = f.project("project");
        let repo = f.repo();
        repo.open_project(&root).unwrap();
        let mut holder = Worker::start(&f, "hold-lock");
        holder.wait_ready(&f, "hold-lock");
        assert_eq!(repo.load(Some(&root)).unwrap_err().code, "lockTimeout");
        holder.0.kill().unwrap();
        holder.0.wait().unwrap();
        assert!(repo.load(Some(&root)).is_ok());
    }
}

impl ViewerError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            config_path: None,
        }
    }
    fn at(code: &'static str, path: &Path, message: impl std::fmt::Display) -> Self {
        Self {
            code,
            message: format!("{message} ({})", path.display()),
            config_path: Some(path.display().to_string()),
        }
    }
}
impl From<String> for ViewerError {
    fn from(message: String) -> Self {
        Self::new("io", message)
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalConfig {
    schema_version: u32,
    #[serde(default)]
    default_settings: ViewerSettings,
    #[serde(default)]
    recent_folders: Vec<RecentFolderEntry>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    schema_version: u32,
    root_path: String,
    #[serde(default)]
    settings: ViewerSettings,
}

#[derive(Default, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub(crate) enum PatchField<T> {
    #[default]
    Keep,
    Set(T),
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SettingsPatch {
    pub theme: PatchField<AppTheme>,
    pub window_size: PatchField<WindowSize>,
    pub plant_uml_jar_path: PatchField<Option<String>>,
}

impl SettingsPatch {
    fn apply(self, settings: &mut ViewerSettings) -> Result<(), ViewerError> {
        if let PatchField::Set(value) = self.theme {
            settings.theme = value;
        }
        if let PatchField::Set(value) = self.window_size {
            validate_window_size(value)?;
            settings.window_size = value;
        }
        if let PatchField::Set(value) = self.plant_uml_jar_path {
            settings.plant_uml_jar_path = normalize_configured_plantuml_path(value)?;
        }
        Ok(())
    }
}

struct ConfigFileLock(std::fs::File);
impl ConfigFileLock {
    fn acquire(path: &Path) -> Result<Self, ViewerError> {
        let parent = path
            .parent()
            .ok_or_else(|| ViewerError::at("io", path, "Invalid config path"))?;
        fs::create_dir_all(parent).map_err(|e| ViewerError::at("io", path, e))?;
        let lock_path = path.with_extension("lock");
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&lock_path)
            .map_err(|e| ViewerError::at("io", path, e))?;
        let started = Instant::now();
        loop {
            match file.try_lock() {
                Ok(()) => return Ok(Self(file)),
                Err(std::fs::TryLockError::WouldBlock)
                    if started.elapsed() < Duration::from_secs(2) =>
                {
                    thread::sleep(Duration::from_millis(10))
                }
                Err(std::fs::TryLockError::WouldBlock) => {
                    return Err(ViewerError::at(
                        "lockTimeout",
                        path,
                        "Timed out waiting for settings lock",
                    ))
                }
                Err(std::fs::TryLockError::Error(e)) => return Err(ViewerError::at("io", path, e)),
            }
        }
    }
}
impl Drop for ConfigFileLock {
    fn drop(&mut self) {
        if let Err(e) = self.0.unlock() {
            eprintln!("Failed to unlock settings: {e}");
        }
    }
}

pub(crate) struct SettingsRepository {
    directory: PathBuf,
    sequence: AtomicU64,
}

impl SettingsRepository {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            sequence: AtomicU64::new(1),
        }
    }
    pub fn project_id(root: &Path) -> Result<String, ViewerError> {
        let path = root.to_str().ok_or_else(|| {
            ViewerError::new("invalidRequest", "Project paths must be valid UTF-8.")
        })?;
        let mut hash = Sha256::new();
        hash.update(b"markdown-viewer-project-v1\0");
        hash.update(std::env::consts::OS.as_bytes());
        hash.update(b"\0");
        hash.update(path.as_bytes());
        Ok(format!("{:x}", hash.finalize()))
    }
    fn project_path(&self, root: &Path) -> Result<PathBuf, ViewerError> {
        Ok(self
            .directory
            .join("projects")
            .join(Self::project_id(root)?)
            .join(APP_CONFIG_FILE_NAME))
    }
    fn write<T: Serialize>(&self, path: &Path, config: &T) -> Result<(), ViewerError> {
        write_app_config_to_path(path, config, self.sequence.fetch_add(1, Ordering::Relaxed))
            .map_err(|e| ViewerError::at("io", path, e))
    }
    fn read_json(path: &Path) -> Result<serde_json::Value, ViewerError> {
        let bytes = fs::read(path).map_err(|e| {
            ViewerError::at(
                if e.kind() == std::io::ErrorKind::NotFound {
                    "missingConfig"
                } else {
                    "io"
                },
                path,
                e,
            )
        })?;
        serde_json::from_slice(&bytes).map_err(|e| ViewerError::at("invalidConfig", path, e))
    }
    fn global<T>(
        &self,
        write: bool,
        update: impl FnOnce(&mut GlobalConfig) -> Result<T, ViewerError>,
    ) -> Result<T, ViewerError> {
        let path = self.directory.join(APP_CONFIG_FILE_NAME);
        let _guard = ConfigFileLock::acquire(&path)?;
        let (mut config, migrate) = if path
            .try_exists()
            .map_err(|e| ViewerError::at("io", &path, e))?
        {
            let json = Self::read_json(&path)?;
            match json.get("schemaVersion") {
                None => {
                    let legacy: AppConfig = serde_json::from_value(json)
                        .map_err(|e| ViewerError::at("invalidConfig", &path, e))?;
                    (
                        GlobalConfig {
                            schema_version: 2,
                            default_settings: legacy.viewer_settings,
                            recent_folders: legacy.recent_folders,
                        },
                        true,
                    )
                }
                Some(value) if value.as_u64() == Some(2) => (
                    serde_json::from_value(json)
                        .map_err(|e| ViewerError::at("invalidConfig", &path, e))?,
                    false,
                ),
                _ => {
                    return Err(ViewerError::at(
                        "invalidConfig",
                        &path,
                        "Unsupported settings schema version",
                    ))
                }
            }
        } else {
            (
                GlobalConfig {
                    schema_version: 2,
                    default_settings: ViewerSettings::default(),
                    recent_folders: Vec::new(),
                },
                true,
            )
        };
        let result = update(&mut config)?;
        if write || migrate {
            self.write(&path, &config)?;
        }
        Ok(result)
    }
    pub fn defaults(&self) -> Result<ViewerSettings, ViewerError> {
        self.global(false, |c| Ok(c.default_settings.clone()))
    }
    pub fn recent(&self) -> Result<Vec<RecentFolderEntry>, ViewerError> {
        self.global(false, |c| Ok(c.recent_folders.clone()))
    }
    pub fn record_recent(&self, path: String) -> Result<Vec<RecentFolderEntry>, ViewerError> {
        let canonical = normalize_path(PathBuf::from(path))?;
        if !canonical.is_dir() {
            return Err(ViewerError::new(
                "invalidRequest",
                "Selected path is not a directory.",
            ));
        }
        let path = path_to_string(&canonical);
        self.global(true, |c| {
            c.recent_folders.retain(|entry| entry.path != path);
            c.recent_folders.insert(
                0,
                RecentFolderEntry {
                    path,
                    name: recent_folder_name(&canonical),
                    last_opened_at: current_unix_seconds(),
                },
            );
            c.recent_folders.truncate(MAX_RECENT_FOLDERS);
            Ok(c.recent_folders.clone())
        })
    }
    pub fn remove_recent(&self, path: String) -> Result<Vec<RecentFolderEntry>, ViewerError> {
        self.global(true, |c| {
            c.recent_folders.retain(|e| e.path != path);
            Ok(c.recent_folders.clone())
        })
    }
    fn read_project(path: &Path, root: &Path) -> Result<ProjectConfig, ViewerError> {
        let config: ProjectConfig = serde_json::from_value(Self::read_json(path)?)
            .map_err(|e| ViewerError::at("invalidConfig", path, e))?;
        if config.schema_version != 1 || config.root_path != root.to_string_lossy() {
            return Err(ViewerError::at(
                "invalidConfig",
                path,
                "Project schema or root path does not match",
            ));
        }
        Ok(config)
    }
    pub fn open_project(&self, root: &Path) -> Result<ViewerSettings, ViewerError> {
        let path = self.project_path(root)?;
        {
            let _guard = ConfigFileLock::acquire(&path)?;
            if path
                .try_exists()
                .map_err(|e| ViewerError::at("io", &path, e))?
            {
                return Ok(Self::read_project(&path, root)?.settings);
            }
        }
        // globalとprojectのlockは重ねない。後着の初回openは先着の設定を使う。
        let defaults = self.defaults()?;
        let _guard = ConfigFileLock::acquire(&path)?;
        if path
            .try_exists()
            .map_err(|e| ViewerError::at("io", &path, e))?
        {
            return Ok(Self::read_project(&path, root)?.settings);
        }
        let config = ProjectConfig {
            schema_version: 1,
            root_path: root.to_string_lossy().into_owned(),
            settings: defaults,
        };
        self.write(&path, &config)?;
        Ok(config.settings)
    }
    pub fn load(&self, root: Option<&Path>) -> Result<ViewerSettings, ViewerError> {
        match root {
            None => self.defaults(),
            Some(root) => {
                let path = self.project_path(root)?;
                let _guard = ConfigFileLock::acquire(&path)?;
                Ok(Self::read_project(&path, root)?.settings)
            }
        }
    }
    pub fn patch(
        &self,
        root: Option<&Path>,
        patch: SettingsPatch,
    ) -> Result<ViewerSettings, ViewerError> {
        if matches!(patch.theme, PatchField::Keep)
            && matches!(patch.window_size, PatchField::Keep)
            && matches!(patch.plant_uml_jar_path, PatchField::Keep)
        {
            return self.load(root);
        }
        match root {
            None => self.global(true, |c| {
                patch.apply(&mut c.default_settings)?;
                Ok(c.default_settings.clone())
            }),
            Some(root) => {
                let path = self.project_path(root)?;
                let _guard = ConfigFileLock::acquire(&path)?;
                let mut config = Self::read_project(&path, root)?;
                patch.apply(&mut config.settings)?;
                self.write(&path, &config)?;
                Ok(config.settings)
            }
        }
    }
}
