use super::*;
use objc2::{available, MainThreadMarker};
use objc2_app_kit::{
    NSApplication, NSApplicationActivationOptions, NSRunningApplication, NSWindow,
};
use serde::de::DeserializeOwned;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::os::unix::fs::{DirBuilderExt, FileTypeExt, MetadataExt, PermissionsExt};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{UnixListener, UnixStream};

const VERSION: u32 = 1;
const FIXED_ITEMS: usize = 6;

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum Request {
    Info {
        version: u32,
    },
    Activate {
        version: u32,
        id: String,
        remaining_ms: u64,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn framed_messages_round_trip_and_reject_oversized_payloads() {
        tauri::async_runtime::block_on(async {
            let (mut a, mut b) = UnixStream::pair().unwrap();
            WindowMenuController::write(&mut a, &Request::Info { version: VERSION })
                .await
                .unwrap();
            assert!(matches!(
                WindowMenuController::read::<Request>(&mut b).await.unwrap(),
                Request::Info { version: VERSION }
            ));
            a.write_u32(16385).await.unwrap();
            assert!(WindowMenuController::read::<Request>(&mut b)
                .await
                .unwrap_err()
                .contains("too large"));
        });
    }

    #[test]
    fn partial_frames_obey_one_deadline() {
        tauri::async_runtime::block_on(async {
            let (mut a, mut b) = UnixStream::pair().unwrap();
            a.write_u32(100).await.unwrap();
            a.write_all(b"{").await.unwrap();
            assert!(tokio::time::timeout(
                Duration::from_millis(30),
                WindowMenuController::read::<Request>(&mut b)
            )
            .await
            .is_err());
        });
    }
}
#[derive(Clone, Deserialize, Serialize)]
struct Info {
    id: String,
    pid: i32,
    version: u32,
    title: String,
}
#[derive(Deserialize, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
enum Reply {
    Info(Info),
    Focused,
    Error(String),
}

pub(crate) struct WindowMenuController {
    session: Arc<ViewerSession>,
    directory: PathBuf,
    socket: PathBuf,
    id: String,
    submenu: Submenu<tauri::Wry>,
    peers: Mutex<HashMap<String, Info>>,
    revision: AtomicU64,
}

impl WindowMenuController {
    pub fn install(app: &tauri::AppHandle, session: Arc<ViewerSession>) -> Result<(), String> {
        // SAFETY: geteuid has no preconditions and does not mutate process state.
        let uid = unsafe { libc::geteuid() };
        let namespace = format!(
            "{}:{}",
            app.config().identifier,
            if cfg!(debug_assertions) {
                "dev"
            } else {
                "release"
            }
        );
        let hash = format!("{:x}", Sha256::digest(namespace.as_bytes()));
        let directory = PathBuf::from(format!("/tmp/mv-{uid}-{}", &hash[..16]));
        match fs::DirBuilder::new().mode(0o700).create(&directory) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
            Err(e) => return Err(e.to_string()),
        }
        let metadata = fs::symlink_metadata(&directory).map_err(|e| e.to_string())?;
        if !metadata.is_dir()
            || metadata.uid() != uid
            || metadata.permissions().mode() & 0o777 != 0o700
        {
            return Err("Unsafe Viewer runtime directory permissions.".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let socket = directory.join(format!("{id}.sock"));
        if socket.as_os_str().as_encoded_bytes().len() >= 104 {
            return Err("Viewer socket path is too long.".into());
        }
        let listener =
            std::os::unix::net::UnixListener::bind(&socket).map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let menu = Menu::default(app).map_err(|e| e.to_string())?;
        let submenu = Submenu::with_id_and_items(
            app,
            "viewer.windows",
            "Window",
            true,
            &[
                &PredefinedMenuItem::minimize(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::maximize(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::close_window(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
                &MenuItem::with_id(
                    app,
                    "viewer.refresh",
                    "Refresh Window List",
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
                &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
            ],
        )
        .map_err(|e| e.to_string())?;
        for (index, item) in menu
            .items()
            .map_err(|e| e.to_string())?
            .into_iter()
            .enumerate()
        {
            if let MenuItemKind::Submenu(sub) = &item {
                if sub.text().map_err(|e| e.to_string())? == "File" {
                    sub.insert(
                        &MenuItem::with_id(
                            app,
                            "viewer.new",
                            "New Window",
                            true,
                            Some("CmdOrCtrl+Shift+N"),
                        )
                        .map_err(|e| e.to_string())?,
                        0,
                    )
                    .map_err(|e| e.to_string())?;
                }
                if sub.id().as_ref() == tauri::menu::WINDOW_SUBMENU_ID {
                    menu.remove(&item).map_err(|e| e.to_string())?;
                    menu.insert(&submenu, index).map_err(|e| e.to_string())?;
                }
            }
        }
        app.set_menu(menu).map_err(|e| e.to_string())?;
        let controller = Arc::new(Self {
            session,
            directory,
            socket,
            id,
            submenu,
            peers: Mutex::new(HashMap::new()),
            revision: AtomicU64::new(0),
        });
        app.manage(controller.clone());
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let listener = match UnixListener::from_std(listener) {
                Ok(l) => l,
                Err(e) => {
                    controller.session.notice(&handle, e.to_string());
                    return;
                }
            };
            let limit = Arc::new(tokio::sync::Semaphore::new(8));
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        if let Ok(permit) = limit.clone().try_acquire_owned() {
                            let controller = controller.clone();
                            let app = handle.clone();
                            tauri::async_runtime::spawn(async move {
                                let _permit = permit;
                                controller.serve(&app, stream).await;
                            });
                        }
                    }
                    Err(e) => {
                        controller
                            .session
                            .notice(&handle, format!("Window listener failed: {e}"));
                        break;
                    }
                }
            }
        });
        Self::refresh(app);
        Ok(())
    }
    fn info(&self) -> Result<Info, String> {
        Ok(Info {
            id: self.id.clone(),
            pid: std::process::id() as i32,
            version: VERSION,
            title: self
                .session
                .identity
                .read()
                .map_err(|_| "Failed to lock window identity.")?
                .title
                .clone(),
        })
    }
    async fn read<T: DeserializeOwned>(stream: &mut UnixStream) -> Result<T, String> {
        let length = stream.read_u32().await.map_err(|e| e.to_string())? as usize;
        if length > 16 * 1024 {
            return Err("Window message is too large.".into());
        }
        let mut bytes = vec![0; length];
        stream
            .read_exact(&mut bytes)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_slice(&bytes).map_err(|e| e.to_string())
    }
    async fn write<T: Serialize>(stream: &mut UnixStream, value: &T) -> Result<(), String> {
        let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        if bytes.len() > 16 * 1024 {
            return Err("Window message is too large.".into());
        }
        stream
            .write_u32(bytes.len() as u32)
            .await
            .map_err(|e| e.to_string())?;
        stream.write_all(&bytes).await.map_err(|e| e.to_string())
    }
    async fn query(path: &Path) -> Result<(UnixStream, Info), String> {
        let mut stream = match UnixStream::connect(path).await {
            Ok(stream) => stream,
            Err(e) => {
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::NotFound
                ) {
                    let _ = fs::remove_file(path); // UUID pathは再利用しない。
                }
                return Err(e.to_string());
            }
        };
        Self::write(&mut stream, &Request::Info { version: VERSION }).await?;
        match Self::read::<Reply>(&mut stream).await? {
            Reply::Info(info)
                if info.version == VERSION
                    && path.file_stem().is_some_and(|id| id == info.id.as_str()) =>
            {
                Ok((stream, info))
            }
            _ => Err("Invalid Viewer identity response.".into()),
        }
    }
    async fn serve(&self, app: &tauri::AppHandle, mut stream: UnixStream) {
        let initial = async {
            match Self::read::<Request>(&mut stream).await? {
                Request::Info { version: VERSION } => {
                    Self::write(&mut stream, &Reply::Info(self.info()?)).await
                }
                _ => Err("Unsupported Viewer protocol.".into()),
            }
        };
        if !matches!(
            tokio::time::timeout(Duration::from_millis(250), initial).await,
            Ok(Ok(()))
        ) {
            return;
        }
        let request =
            tokio::time::timeout(Duration::from_secs(2), Self::read::<Request>(&mut stream)).await;
        if let Ok(Ok(Request::Activate {
            version: VERSION,
            id,
            remaining_ms,
        })) = request
        {
            if id != self.id || remaining_ms == 0 || remaining_ms > 2000 {
                return;
            }
            let result =
                Self::activate_local(app, Instant::now() + Duration::from_millis(remaining_ms))
                    .await;
            let reply = match result {
                Ok(()) => Reply::Focused,
                Err(e) => Reply::Error(e),
            };
            let _ =
                tokio::time::timeout(Duration::from_millis(250), Self::write(&mut stream, &reply))
                    .await;
        }
    }
    async fn activate_local(app: &tauri::AppHandle, deadline: Instant) -> Result<(), String> {
        let mut restored = false;
        loop {
            if Instant::now() >= deadline {
                return Err("Window activation timed out.".into());
            }
            let (send, receive) = tokio::sync::oneshot::channel();
            let handle = app.clone();
            app.run_on_main_thread(move || {
                let result = (|| -> Result<bool, String> {
                    if Instant::now() >= deadline {
                        return Err("Window activation expired.".into());
                    }
                    let window = handle
                        .get_webview_window("main")
                        .ok_or("Viewer window closed.")?;
                    let pointer = window.ns_window().map_err(|e| e.to_string())? as *const NSWindow;
                    // SAFETY: borrowed live Tauri NSWindow on its main thread.
                    let native = unsafe { &*pointer };
                    let application = NSApplication::sharedApplication(
                        MainThreadMarker::new().ok_or("Expected main thread.")?,
                    );
                    if !restored {
                        application.unhide(None);
                        if native.isMiniaturized() {
                            native.deminiaturize(None);
                        }
                    }
                    if !native.isMiniaturized() {
                        native.makeKeyAndOrderFront(None);
                        if available!(macos = 14.0) {
                            application.activate();
                        } else {
                            #[allow(deprecated)]
                            application.activateIgnoringOtherApps(true);
                        }
                    }
                    Ok(native.isKeyWindow() && application.isActive() && native.isOnActiveSpace())
                })();
                let _ = send.send(result);
            })
            .map_err(|e| e.to_string())?;
            match tokio::time::timeout(deadline.saturating_duration_since(Instant::now()), receive)
                .await
            {
                Ok(Ok(Ok(true))) => return Ok(()),
                Ok(Ok(Err(e))) => return Err(e),
                Ok(Ok(Ok(false))) => (),
                _ => return Err("Window activation timed out.".into()),
            }
            restored = true;
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }
    async fn activate(&self, app: &tauri::AppHandle, id: String) -> Result<(), String> {
        let deadline = Instant::now() + Duration::from_secs(2);
        if id == self.id {
            return Self::activate_local(app, deadline).await;
        }
        if uuid::Uuid::parse_str(&id).is_err() {
            return Err("Invalid Viewer instance ID.".into());
        }
        let (mut stream, info) = tokio::time::timeout(
            Duration::from_millis(250),
            Self::query(&self.directory.join(format!("{id}.sock"))),
        )
        .await
        .map_err(|e| e.to_string())??;
        let (send, receive) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let result = (|| -> Result<(), String> {
                if Instant::now() >= deadline {
                    return Err("Activation request expired.".into());
                }
                let application = NSApplication::sharedApplication(
                    MainThreadMarker::new().ok_or("Expected main thread.")?,
                );
                if !application.isActive() {
                    return Err(
                        "Window switching was cancelled because the requesting app lost focus."
                            .into(),
                    );
                }
                let target =
                    NSRunningApplication::runningApplicationWithProcessIdentifier(info.pid)
                        .ok_or("Viewer process exited.")?;
                if available!(macos = 14.0) {
                    application.yieldActivationToApplication(&target);
                    if !target.activateFromApplication_options(
                        &NSRunningApplication::currentApplication(),
                        NSApplicationActivationOptions::ActivateAllWindows,
                    ) {
                        return Err("macOS declined window activation.".into());
                    }
                }
                Ok(())
            })();
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
        tokio::time::timeout(deadline.saturating_duration_since(Instant::now()), receive)
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())??;
        let remaining_ms = deadline
            .saturating_duration_since(Instant::now())
            .as_millis() as u64;
        let exchange = async {
            Self::write(
                &mut stream,
                &Request::Activate {
                    version: VERSION,
                    id,
                    remaining_ms,
                },
            )
            .await?;
            match Self::read::<Reply>(&mut stream).await? {
                Reply::Focused => Ok(()),
                Reply::Error(e) => Err(e),
                _ => Err("Invalid activation reply.".into()),
            }
        };
        tokio::time::timeout(deadline.saturating_duration_since(Instant::now()), exchange)
            .await
            .map_err(|_| "Window activation timed out.".to_string())?
    }
    pub fn refresh(app: &tauri::AppHandle) {
        let Some(controller) = app.try_state::<Arc<Self>>().map(|s| s.inner().clone()) else {
            return;
        };
        let revision = controller.revision.fetch_add(1, Ordering::AcqRel) + 1;
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut peers = Vec::new();
            let mut partial = false;
            let mut tasks = tokio::task::JoinSet::new();
            let limit = Arc::new(tokio::sync::Semaphore::new(8));
            let entries = fs::read_dir(&controller.directory);
            if let Ok(entries) = entries {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_socket())
                        || path
                            .file_stem()
                            .and_then(|v| v.to_str())
                            .is_none_or(|v| uuid::Uuid::parse_str(v).is_err())
                    {
                        continue;
                    }
                    let limit = limit.clone();
                    tasks.spawn(async move {
                        let _permit = limit.acquire().await.map_err(|e| e.to_string())?;
                        tokio::time::timeout(Duration::from_millis(250), Self::query(&path))
                            .await
                            .map_err(|e| e.to_string())?
                            .map(|(_, info)| info)
                    });
                }
            } else {
                partial = true;
            }
            let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
            while !tasks.is_empty() {
                match tokio::time::timeout_at(deadline, tasks.join_next()).await {
                    Ok(Some(Ok(Ok(info)))) => peers.push(info),
                    Ok(Some(_)) => partial = true,
                    _ => {
                        partial = true;
                        break;
                    }
                }
            }
            tasks.abort_all();
            peers.sort_by(|a, b| a.title.cmp(&b.title).then(a.id.cmp(&b.id)));
            let main_handle = handle.clone();
            let owner = controller.clone();
            if let Err(e) = handle.run_on_main_thread(move || {
                if owner.revision.load(Ordering::Acquire) != revision {
                    return;
                }
                if let Err(e) = owner.update_menu(&main_handle, peers, partial) {
                    owner.session.notice(&main_handle, e);
                }
            }) {
                controller.session.notice(&handle, e.to_string());
            }
        });
    }
    fn update_menu(
        &self,
        app: &tauri::AppHandle,
        peers: Vec<Info>,
        partial: bool,
    ) -> Result<(), String> {
        while self.submenu.items().map_err(|e| e.to_string())?.len() > FIXED_ITEMS {
            self.submenu
                .remove_at(FIXED_ITEMS)
                .map_err(|e| e.to_string())?;
        }
        let mut lookup = self
            .peers
            .lock()
            .map_err(|_| "Failed to lock window list.")?;
        lookup.clear();
        for info in &peers {
            let duplicate = peers.iter().filter(|p| p.title == info.title).count() > 1;
            let short = &info.id[..8];
            let suffix = if peers.iter().filter(|p| p.id.starts_with(short)).count() > 1 {
                &info.id
            } else {
                short
            };
            let label = if duplicate {
                format!("{} [{suffix}]", info.title)
            } else {
                info.title.clone()
            };
            let id = format!("viewer.instance.{}", info.id);
            self.submenu
                .append(
                    &CheckMenuItem::with_id(
                        app,
                        &id,
                        label,
                        true,
                        info.id == self.id,
                        None::<&str>,
                    )
                    .map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
            lookup.insert(id, info.clone());
        }
        if partial {
            self.submenu
                .append(
                    &MenuItem::new(
                        app,
                        "Some windows could not be reached",
                        false,
                        None::<&str>,
                    )
                    .map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    pub fn menu_event(app: &tauri::AppHandle, id: &str) {
        let Some(owner) = app.try_state::<Arc<Self>>().map(|s| s.inner().clone()) else {
            return;
        };
        if id == "viewer.refresh" {
            Self::refresh(app);
            return;
        }
        let peer = owner.peers.lock().ok().and_then(|p| p.get(id).cloned());
        if let Ok(items) = owner.submenu.items() {
            for item in items {
                if let MenuItemKind::Check(item) = item {
                    if let Err(e) = item
                        .set_checked(item.id().as_ref() == format!("viewer.instance.{}", owner.id))
                    {
                        owner.session.notice(app, e.to_string());
                    }
                }
            }
        }
        let handle = app.clone();
        if id == "viewer.new" {
            tauri::async_runtime::spawn_blocking(move || {
                if let Err(e) = owner.session.launcher.launch() {
                    owner.session.notice(&handle, e.message);
                }
            });
        } else if let Some(peer) = peer {
            tauri::async_runtime::spawn(async move {
                if let Err(e) = owner.activate(&handle, peer.id).await {
                    owner.session.notice(&handle, e);
                }
                Self::refresh(&handle);
            });
        }
    }
    pub fn cleanup(&self) {
        if let Err(e) = fs::remove_file(&self.socket) {
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("Failed to remove Viewer socket: {e}");
            }
        }
    }
}
