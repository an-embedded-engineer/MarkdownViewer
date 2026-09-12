use super::*;
use tauri::Emitter;
use window_identity::WindowIdentity;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum SettingsContext {
    Default {
        #[serde(rename = "rootGeneration")]
        root_generation: String,
    },
    Project {
        #[serde(rename = "projectId")]
        project_id: String,
        #[serde(rename = "rootGeneration")]
        root_generation: String,
    },
}
impl SettingsContext {
    fn generation(&self) -> Result<u64, ViewerError> {
        let value = match self {
            Self::Default { root_generation }
            | Self::Project {
                root_generation, ..
            } => root_generation,
        };
        value
            .parse::<u64>()
            .ok()
            .filter(|v| v.to_string() == *value)
            .ok_or_else(|| ViewerError::new("invalidRequest", "Invalid root generation."))
    }
}
struct SessionState {
    context: SettingsContext,
    settings: ViewerSettings,
    initialized: bool,
}

pub(crate) struct ViewerSession {
    state: Mutex<SessionState>,
    pub repository: SettingsRepository,
    pub documents: DocumentStore,
    pub identity: RwLock<WindowIdentity>,
    pub launcher: instance_launcher::InstanceLauncher,
    notices: Mutex<Vec<Notice>>,
}

#[derive(Clone, Serialize)]
pub(crate) struct Notice {
    id: String,
    message: String,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Presentation {
    actual_logical_size: Option<WindowSize>,
    size_applied: bool,
    special_state: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StartupState {
    context: SettingsContext,
    settings: ViewerSettings,
    recent_folders: Vec<RecentFolderEntry>,
    presentation: Presentation,
    warnings: Vec<String>,
    global_config_error: Option<ViewerError>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RootOpenResult {
    tree: FileTreeNode,
    canonical_root_path: String,
    settings: ViewerSettings,
    context: SettingsContext,
    presentation: Presentation,
    warnings: Vec<String>,
}
#[derive(Serialize)]
pub(crate) struct ReloadResult {
    tree: FileTreeNode,
    settings: ViewerSettings,
    warnings: Vec<String>,
}

impl ViewerSession {
    pub fn new(directory: PathBuf, documents: DocumentStore) -> Self {
        Self {
            state: Mutex::new(SessionState {
                context: SettingsContext::Default {
                    root_generation: "0".into(),
                },
                settings: ViewerSettings::default(),
                initialized: false,
            }),
            repository: SettingsRepository::new(directory),
            documents,
            identity: RwLock::new(WindowIdentity::for_root(None)),
            launcher: Default::default(),
            notices: Mutex::new(Vec::new()),
        }
    }
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, SessionState>, ViewerError> {
        self.state
            .lock()
            .map_err(|_| ViewerError::new("io", "Failed to lock Viewer session."))
    }
    fn check(state: &SessionState, context: &SettingsContext) -> Result<(), ViewerError> {
        if state.context != *context {
            return Err(ViewerError::new(
                "staleContext",
                "The selected folder changed. Please retry the operation.",
            ));
        }
        Ok(())
    }
    pub fn notice(&self, app: &tauri::AppHandle, message: String) {
        if let Ok(mut notices) = self.notices.lock() {
            notices.push(Notice {
                id: uuid::Uuid::new_v4().to_string(),
                message,
            });
        }
        if let Err(error) = app.emit_to("main", "viewer-notices-available", ()) {
            eprintln!("Failed to notify Viewer: {error}");
        }
    }
    fn startup(&self) -> Result<StartupState, ViewerError> {
        let mut state = self.lock()?;
        let mut warnings = Vec::new();
        let mut global_config_error = None;
        if !state.initialized {
            match self.repository.defaults() {
                Ok(settings) => {
                    let loaded = normalize_viewer_settings(&settings);
                    state.settings = loaded.settings;
                    warnings = loaded.warnings;
                }
                Err(error) => global_config_error = Some(error),
            }
            state.initialized = true;
        }
        let recent_folders = self.repository.recent().unwrap_or_else(|e| {
            if global_config_error.is_none() {
                global_config_error = Some(e);
            }
            Vec::new()
        });
        Ok(StartupState {
            context: state.context.clone(),
            settings: state.settings.clone(),
            recent_folders,
            presentation: Presentation::default(),
            warnings,
            global_config_error,
        })
    }
    fn open(&self, path: String, context: SettingsContext) -> Result<RootOpenResult, ViewerError> {
        let mut state = self.lock()?;
        Self::check(&state, &context)?;
        let root = normalize_path(PathBuf::from(path))?;
        if !root.is_dir() {
            return Err(ViewerError::new(
                "invalidRequest",
                "Selected path is not a directory.",
            ));
        }
        let tree = build_tree(&root, &root)?;
        let loaded = normalize_viewer_settings(&self.repository.open_project(&root)?);
        let generation = context
            .generation()?
            .checked_add(1)
            .ok_or_else(|| ViewerError::new("io", "Root generation exhausted."))?;
        let project_id = SettingsRepository::project_id(&root)?;
        let identity = WindowIdentity::for_root(Some(&root));
        let mut snapshot = self
            .documents
            .current_root
            .write()
            .map_err(|_| ViewerError::new("io", "Failed to lock document root."))?;
        let mut current_identity = self
            .identity
            .write()
            .map_err(|_| ViewerError::new("io", "Failed to lock window identity."))?;
        *snapshot = Some(RootSnapshot {
            path: root.clone(),
            generation,
        });
        *current_identity = identity;
        state.context = SettingsContext::Project {
            project_id,
            root_generation: generation.to_string(),
        };
        state.settings = loaded.settings.clone();
        Ok(RootOpenResult {
            tree,
            canonical_root_path: path_to_string(&root),
            settings: loaded.settings,
            context: state.context.clone(),
            presentation: Presentation::default(),
            warnings: loaded.warnings,
        })
    }
    fn settings(
        &self,
        context: &SettingsContext,
        patch: Option<SettingsPatch>,
    ) -> Result<ViewerSettingsLoadResult, ViewerError> {
        let mut state = self.lock()?;
        Self::check(&state, context)?;
        let snapshot = self.documents.snapshot()?;
        let root = snapshot.as_ref().map(|r| r.path.as_path());
        let settings = match patch {
            Some(patch) => self.repository.patch(root, patch)?,
            None => self.repository.load(root)?,
        };
        let loaded = normalize_viewer_settings(&settings);
        state.settings = loaded.settings.clone();
        Ok(loaded)
    }
    fn reload(&self, context: &SettingsContext) -> Result<ReloadResult, ViewerError> {
        let mut state = self.lock()?;
        Self::check(&state, context)?;
        let root = self
            .documents
            .snapshot()?
            .ok_or_else(|| ViewerError::new("invalidRequest", "No folder selected."))?
            .path;
        let tree = build_tree(&root, &root)?;
        let loaded = normalize_viewer_settings(&self.repository.load(Some(&root))?);
        state.settings = loaded.settings.clone();
        Ok(ReloadResult {
            tree,
            settings: loaded.settings,
            warnings: loaded.warnings,
        })
    }
    async fn present(
        self: &Arc<Self>,
        app: &tauri::AppHandle,
        context: SettingsContext,
        settings: ViewerSettings,
    ) -> (Presentation, Vec<String>) {
        let (send, receive) = tokio::sync::oneshot::channel();
        let session = self.clone();
        let handle = app.clone();
        let dispatched = app.run_on_main_thread(move || {
            let mut warnings = Vec::new();
            let mut presentation = Presentation::default();
            let result = (|| -> Result<(), String> {
                let current = session.documents.snapshot()?.map_or(0, |r| r.generation);
                if context.generation().map_err(|e| e.message)? != current {
                    return Ok(());
                }
                let window = handle
                    .get_webview_window("main")
                    .ok_or("Viewer window is unavailable.")?;
                let title = session
                    .identity
                    .read()
                    .map_err(|_| "Failed to lock window identity.")?
                    .title
                    .clone();
                if let Err(e) = window.set_title(&title) {
                    warnings.push(format!("Failed to update title: {e}"));
                }
                presentation.special_state = window.is_maximized().map_err(|e| e.to_string())?
                    || window.is_minimized().map_err(|e| e.to_string())?
                    || window.is_fullscreen().map_err(|e| e.to_string())?;
                if !presentation.special_state {
                    match window.set_size(tauri::LogicalSize::new(
                        settings.window_size.width,
                        settings.window_size.height,
                    )) {
                        Ok(()) => presentation.size_applied = true,
                        Err(e) => warnings.push(format!("Failed to restore window size: {e}")),
                    }
                }
                let size = window
                    .inner_size()
                    .map_err(|e| e.to_string())?
                    .to_logical::<u32>(window.scale_factor().map_err(|e| e.to_string())?);
                presentation.actual_logical_size = Some(WindowSize {
                    width: size.width,
                    height: size.height,
                });
                Ok(())
            })();
            if let Err(error) = result {
                warnings.push(error);
            }
            let _ = send.send((presentation, warnings));
        });
        if let Err(error) = dispatched {
            return (Presentation::default(), vec![error.to_string()]);
        }
        receive
            .await
            .unwrap_or_else(|e| (Presentation::default(), vec![e.to_string()]))
    }
}

async fn blocking<T: Send + 'static>(
    action: impl FnOnce() -> Result<T, ViewerError> + Send + 'static,
) -> Result<T, ViewerError> {
    tauri::async_runtime::spawn_blocking(action)
        .await
        .map_err(|e| ViewerError::new("io", e.to_string()))?
}

#[tauri::command]
pub(crate) async fn load_startup_state(
    app: tauri::AppHandle,
    session: State<'_, Arc<ViewerSession>>,
) -> Result<StartupState, ViewerError> {
    let owned = session.inner().clone();
    let work = owned.clone();
    let mut result = blocking(move || work.startup()).await?;
    let (presentation, warnings) = owned
        .present(&app, result.context.clone(), result.settings.clone())
        .await;
    result.presentation = presentation;
    result.warnings.extend(warnings);
    Ok(result)
}
#[tauri::command]
pub(crate) async fn open_root(
    app: tauri::AppHandle,
    session: State<'_, Arc<ViewerSession>>,
    path: String,
    expected_context: SettingsContext,
) -> Result<RootOpenResult, ViewerError> {
    let owned = session.inner().clone();
    let work = owned.clone();
    let mut result = blocking(move || work.open(path, expected_context)).await?;
    let (presentation, warnings) = owned
        .present(&app, result.context.clone(), result.settings.clone())
        .await;
    result.presentation = presentation;
    result.warnings.extend(warnings);
    #[cfg(target_os = "macos")]
    macos_instances::WindowMenuController::refresh(&app);
    Ok(result)
}
#[tauri::command]
pub(crate) async fn reload_root(
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
) -> Result<ReloadResult, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.reload(&context)).await
}
#[tauri::command]
pub(crate) async fn load_context_settings(
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
) -> Result<ViewerSettingsLoadResult, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.settings(&context, None)).await
}
#[tauri::command]
pub(crate) async fn patch_context_settings(
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
    patch: SettingsPatch,
) -> Result<ViewerSettingsLoadResult, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.settings(&context, Some(patch))).await
}
#[tauri::command]
pub(crate) async fn open_document(
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
    path: String,
) -> Result<OpenDocumentResponse, ViewerError> {
    let session = session.inner().clone();
    blocking(move || {
        let generation = context.generation()?;
        let snapshot = {
            let state = session.lock()?;
            ViewerSession::check(&state, &context)?;
            session
                .documents
                .snapshot()?
                .ok_or_else(|| ViewerError::new("invalidRequest", "No folder selected."))?
        };
        // gate解放後も照合したsnapshotだけをI/Oに用いる。
        DocumentStore::open_snapshot(path, snapshot, generation).map_err(ViewerError::from)
    })
    .await
}
#[tauri::command]
pub(crate) async fn render_plantuml_diagrams(
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
    sources: Vec<String>,
) -> Result<PlantUmlRenderResponse, ViewerError> {
    let session = session.inner().clone();
    blocking(move || {
        let runtime = {
            let state = session.lock()?;
            ViewerSession::check(&state, &context)?;
            resolve_plantuml_runtime(state.settings.plant_uml_jar_path.as_deref())?
        };
        render_plantuml_diagrams_blocking(sources, runtime).map_err(ViewerError::from)
    })
    .await
}
#[tauri::command]
pub(crate) async fn load_recent_folders(
    session: State<'_, Arc<ViewerSession>>,
) -> Result<Vec<RecentFolderEntry>, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.repository.recent()).await
}
#[tauri::command]
pub(crate) async fn record_recent_folder(
    session: State<'_, Arc<ViewerSession>>,
    path: String,
) -> Result<Vec<RecentFolderEntry>, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.repository.record_recent(path)).await
}
#[tauri::command]
pub(crate) async fn remove_recent_folder(
    session: State<'_, Arc<ViewerSession>>,
    path: String,
) -> Result<Vec<RecentFolderEntry>, ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.repository.remove_recent(path)).await
}
#[tauri::command]
pub(crate) async fn new_window(session: State<'_, Arc<ViewerSession>>) -> Result<(), ViewerError> {
    let session = session.inner().clone();
    blocking(move || session.launcher.launch()).await
}
#[tauri::command]
pub(crate) async fn retry_window_presentation(
    app: tauri::AppHandle,
    session: State<'_, Arc<ViewerSession>>,
    context: SettingsContext,
) -> Result<(Presentation, Vec<String>), ViewerError> {
    let owned = session.inner().clone();
    let work = owned.clone();
    let ctx = context.clone();
    let settings = blocking(move || {
        let state = work.lock()?;
        ViewerSession::check(&state, &ctx)?;
        Ok(state.settings.clone())
    })
    .await?;
    Ok(owned.present(&app, context, settings).await)
}
#[tauri::command]
pub(crate) fn drain_viewer_notices(
    session: State<'_, Arc<ViewerSession>>,
) -> Result<Vec<Notice>, ViewerError> {
    Ok(std::mem::take(&mut *session.notices.lock().map_err(
        |_| ViewerError::new("io", "Failed to lock notices."),
    )?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_commit_preserves_failures_and_rejects_stale_settings_and_html() {
        let temporary = std::env::temp_dir().join(format!("mv-session-{}", uuid::Uuid::new_v4()));
        let a = temporary.join("a");
        let b = temporary.join("b");
        fs::create_dir_all(&a).unwrap();
        fs::create_dir_all(&b).unwrap();
        fs::write(
            a.join("index.html"),
            "<link href='style.css' rel='stylesheet'>old",
        )
        .unwrap();
        fs::write(a.join("style.css"), "body{color:red}").unwrap();
        fs::write(b.join("index.html"), "new").unwrap();
        let session = ViewerSession::new(temporary.join("config"), DocumentStore::default());
        let initial = session.startup().unwrap();
        let first = session
            .open(a.to_string_lossy().into_owned(), initial.context)
            .unwrap();
        let snapshot = session.documents.snapshot().unwrap().unwrap();
        let opened = DocumentStore::open_snapshot(
            a.join("index.html").to_string_lossy().into_owned(),
            snapshot.clone(),
            1,
        )
        .unwrap();
        assert!(opened
            .preview_url
            .unwrap()
            .contains("/document/1/index%2Ehtml"));
        let css = Request::builder()
            .uri("mvhtml://localhost/document/1/style.css")
            .body(Vec::new())
            .unwrap();
        assert_eq!(
            session.documents.serve_protocol_request(&css).status(),
            StatusCode::OK
        );
        assert!(session
            .open(
                temporary.join("missing").to_string_lossy().into_owned(),
                first.context.clone()
            )
            .is_err());
        assert_eq!(session.documents.snapshot().unwrap().unwrap().generation, 1);
        let second = session
            .open(b.to_string_lossy().into_owned(), first.context.clone())
            .unwrap();
        assert!(
            matches!(second.context, SettingsContext::Project { ref root_generation, .. } if root_generation == "2")
        );
        assert_eq!(
            session
                .settings(&first.context, Some(SettingsPatch::default()))
                .unwrap_err()
                .code,
            "staleContext"
        );
        let old = Request::builder()
            .uri("mvhtml://localhost/document/1/index.html")
            .body(Vec::new())
            .unwrap();
        assert_eq!(
            session.documents.serve_protocol_request(&old).status(),
            StatusCode::GONE
        );
        // commit前に取得したsnapshotは新Rootの同名fileを返さない。
        assert_eq!(
            DocumentStore::open_snapshot(
                a.join("index.html").to_string_lossy().into_owned(),
                snapshot,
                1
            )
            .unwrap()
            .document_type,
            DocumentType::Html
        );
        assert!(session
            .repository
            .load(Some(&b.canonicalize().unwrap()))
            .is_ok());
        fs::remove_dir_all(temporary).unwrap();
    }
}
