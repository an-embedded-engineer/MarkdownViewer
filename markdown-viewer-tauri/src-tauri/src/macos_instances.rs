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

struct InstanceDirectory;
impl InstanceDirectory {
    fn validate(directory: &Path, uid: u32) -> Result<(), String> {
        let metadata = fs::symlink_metadata(directory).map_err(|e| e.to_string())?;
        if !metadata.is_dir()
            || metadata.uid() != uid
            || metadata.permissions().mode() & 0o777 != 0o700
        {
            return Err(format!(
                "Unsafe Viewer runtime directory: {}",
                directory.display()
            ));
        }
        Ok(())
    }
    fn prepare(
        directory: &Path,
        uid: u32,
        id: &str,
    ) -> Result<(std::os::unix::net::UnixListener, PathBuf), String> {
        match fs::DirBuilder::new().mode(0o700).create(directory) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
            Err(e) => return Err(e.to_string()),
        }
        Self::validate(directory, uid)?;
        let socket = directory.join(format!("{id}.sock"));
        if socket.as_os_str().as_encoded_bytes().len() >= 104 {
            return Err("Viewer socket path is too long.".into());
        }
        let listener =
            std::os::unix::net::UnixListener::bind(&socket).map_err(|e| e.to_string())?;
        if let Err(error) = listener.set_nonblocking(true) {
            let _ = fs::remove_file(&socket);
            return Err(error.to_string());
        }
        Ok((listener, socket))
    }
    fn transient_accept_error(error: &std::io::Error) -> bool {
        matches!(
            error.kind(),
            std::io::ErrorKind::Interrupted
                | std::io::ErrorKind::WouldBlock
                | std::io::ErrorKind::ConnectionAborted
        ) || matches!(
            error.raw_os_error(),
            Some(libc::EMFILE | libc::ENFILE | libc::ENOBUFS | libc::ENOMEM)
        )
    }
}

struct WindowList;
struct WindowListEntry {
    info: Info,
    label: String,
    checked: bool,
}
impl WindowList {
    fn checked(menu_id: &str, own_id: &str) -> bool {
        menu_id == format!("viewer.instance.{own_id}")
    }
    fn entries(mut peers: Vec<Info>, own_id: &str) -> Vec<WindowListEntry> {
        peers.sort_by(|a, b| a.title.cmp(&b.title).then(a.id.cmp(&b.id)));
        peers
            .iter()
            .map(|info| {
                let duplicate = peers.iter().filter(|p| p.title == info.title).count() > 1;
                let short = &info.id[..8]; // InfoはUUID socket名との一致を検証済み。
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
                WindowListEntry {
                    info: info.clone(),
                    label,
                    checked: Self::checked(&format!("viewer.instance.{}", info.id), own_id),
                }
            })
            .collect()
    }
}

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
            InstanceProtocol::write(&mut a, &Request::Info { version: VERSION })
                .await
                .unwrap();
            assert!(matches!(
                InstanceProtocol::read::<Request>(&mut b).await.unwrap(),
                Request::Info { version: VERSION }
            ));
            a.write_u32(16385).await.unwrap();
            assert!(InstanceProtocol::read::<Request>(&mut b)
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
                InstanceProtocol::read::<Request>(&mut b)
            )
            .await
            .is_err());
        });
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
struct Info {
    id: String,
    pid: i32,
    version: u32,
    title: String,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
enum Reply {
    Info(Info),
    Focused,
    Error(String),
}

pub(crate) struct WindowMenuController {
    session: Arc<ViewerSession>,
    directory: PathBuf,
    socket: Option<PathBuf>,
    runtime_error: RwLock<Option<String>>,
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
        let id = uuid::Uuid::new_v4().to_string();
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
        let prepared = InstanceDirectory::prepare(&directory, uid, &id);
        let (listener, socket, runtime_error) = match prepared {
            Ok((listener, socket)) => (Some(listener), Some(socket), None),
            Err(error) => (None, None, Some(error)),
        };
        let controller = Arc::new(Self {
            session,
            directory,
            socket,
            runtime_error: RwLock::new(runtime_error.clone()),
            id,
            submenu,
            peers: Mutex::new(HashMap::new()),
            revision: AtomicU64::new(0),
        });
        app.manage(controller.clone());
        if let Some(error) = runtime_error {
            controller
                .session
                .notice(app, format!("Window switching is unavailable: {error}"));
        }
        let handle = app.clone();
        if let Some(listener) = listener {
            tauri::async_runtime::spawn(async move {
                let listener = match UnixListener::from_std(listener) {
                    Ok(l) => l,
                    Err(e) => {
                        controller.stop_listener(&handle, e.to_string());
                        return;
                    }
                };
                let limit = Arc::new(tokio::sync::Semaphore::new(8));
                let mut reported = false;
                loop {
                    match listener.accept().await {
                        Ok((stream, _)) => {
                            reported = false;
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
                            if InstanceDirectory::transient_accept_error(&e) {
                                if !reported {
                                    controller.session.notice(
                                        &handle,
                                        format!("Window listener will retry: {e}"),
                                    );
                                }
                                reported = true;
                                tokio::time::sleep(Duration::from_millis(100)).await;
                                continue;
                            }
                            controller.stop_listener(&handle, e.to_string());
                            break;
                        }
                    }
                }
            });
        }
        Self::refresh(app);
        Ok(())
    }
    fn stop_listener(&self, app: &tauri::AppHandle, message: String) {
        if let Ok(mut error) = self.runtime_error.write() {
            *error = Some(message.clone());
        }
        self.session.notice(
            app,
            format!("Window listener stopped. Restart this Viewer: {message}"),
        );
        Self::refresh(app);
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
    async fn serve(&self, app: &tauri::AppHandle, stream: UnixStream) {
        if let Ok(info) = self.info() {
            InstanceProtocol::serve(info, stream, |deadline| Self::activate_local(app, deadline))
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
            InstanceProtocol::query(&self.directory.join(format!("{id}.sock"))),
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
            InstanceProtocol::write(
                &mut stream,
                &Request::Activate {
                    version: VERSION,
                    id,
                    remaining_ms,
                },
            )
            .await?;
            match InstanceProtocol::read::<Reply>(&mut stream).await? {
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
            let unavailable = controller
                .runtime_error
                .read()
                .map_or(true, |e| e.is_some());
            let (peers, partial) = if unavailable {
                (Vec::new(), false)
            } else {
                InstanceProtocol::discover(&controller.directory, Duration::from_secs(2)).await
            };
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
        for entry in WindowList::entries(peers, &self.id) {
            let info = entry.info;
            let id = format!("viewer.instance.{}", info.id);
            self.submenu
                .append(
                    &CheckMenuItem::with_id(
                        app,
                        &id,
                        entry.label,
                        true,
                        entry.checked,
                        None::<&str>,
                    )
                    .map_err(|e| e.to_string())?,
                )
                .map_err(|e| e.to_string())?;
            lookup.insert(id, info.clone());
        }
        let unavailable = self
            .runtime_error
            .read()
            .map_or(true, |error| error.is_some());
        if partial || unavailable {
            self.submenu
                .append(
                    &MenuItem::new(
                        app,
                        if unavailable {
                            "Window list is unavailable"
                        } else {
                            "Some windows could not be reached"
                        },
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
                    if let Err(e) =
                        item.set_checked(WindowList::checked(item.id().as_ref(), &owner.id))
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
        let Some(socket) = &self.socket else {
            return;
        };
        if let Err(e) = fs::remove_file(socket) {
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("Failed to remove Viewer socket: {e}");
            }
        }
    }
}

struct InstanceProtocol;
impl InstanceProtocol {
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
    async fn serve<F, Fut>(info: Info, mut stream: UnixStream, activate: F)
    where
        F: FnOnce(Instant) -> Fut,
        Fut: std::future::Future<Output = Result<(), String>>,
    {
        let initial = async {
            match Self::read::<Request>(&mut stream).await? {
                Request::Info { version: VERSION } => {
                    Self::write(&mut stream, &Reply::Info(info.clone())).await
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
            if id != info.id || remaining_ms == 0 || remaining_ms > 2000 {
                return;
            }
            let result = activate(Instant::now() + Duration::from_millis(remaining_ms)).await;
            let reply = match result {
                Ok(()) => Reply::Focused,
                Err(e) => Reply::Error(e),
            };
            let _ =
                tokio::time::timeout(Duration::from_millis(250), Self::write(&mut stream, &reply))
                    .await;
        }
    }
    async fn discover(directory: &Path, duration: Duration) -> (Vec<Info>, bool) {
        let mut peers = Vec::new();
        let mut partial = false;
        let mut tasks = tokio::task::JoinSet::new();
        let limit = Arc::new(tokio::sync::Semaphore::new(8));
        let entries = fs::read_dir(directory);
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
        let deadline = tokio::time::Instant::now() + duration;
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
        (peers, partial)
    }
}

#[cfg(test)]
mod boundary_tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = PathBuf::from("/tmp").join(format!(
                "mv-ipc-test-{}",
                &uuid::Uuid::new_v4().simple().to_string()[..12]
            ));
            fs::DirBuilder::new().mode(0o700).create(&path).unwrap();
            Self(path)
        }
        fn info(&self, title: &str) -> Info {
            Info {
                id: uuid::Uuid::new_v4().to_string(),
                pid: 1,
                version: VERSION,
                title: title.into(),
            }
        }
        fn path(&self, info: &Info) -> PathBuf {
            self.0.join(format!("{}.sock", info.id))
        }
        fn reply_server(&self, info: Info, path: &Path) -> tokio::task::JoinHandle<()> {
            let listener = UnixListener::bind(path).unwrap();
            tokio::spawn(async move {
                let (mut stream, _) = listener.accept().await.unwrap();
                let _ = InstanceProtocol::read::<Request>(&mut stream)
                    .await
                    .unwrap();
                InstanceProtocol::write(&mut stream, &Reply::Info(info))
                    .await
                    .unwrap();
            })
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn runtime_validation_rejects_symlink_wrong_owner_and_mode() {
        let f = Fixture::new();
        // SAFETY: geteuid is a read-only process identity query.
        let uid = unsafe { libc::geteuid() };
        assert!(InstanceDirectory::validate(&f.0, uid).is_ok());
        assert!(InstanceDirectory::validate(&f.0, uid ^ 1).is_err());
        fs::set_permissions(&f.0, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(InstanceDirectory::validate(&f.0, uid).is_err());
        fs::set_permissions(&f.0, fs::Permissions::from_mode(0o700)).unwrap();
        let link = f.0.join("link");
        std::os::unix::fs::symlink(&f.0, &link).unwrap();
        assert!(InstanceDirectory::validate(&link, uid).is_err());
        assert!(InstanceDirectory::prepare(&f.0, uid, &"x".repeat(110)).is_err());
    }

    #[test]
    fn labels_are_stable_disambiguate_no_folder_and_restore_own_check() {
        let f = Fixture::new();
        let mut a = f.info("No Folder — MarkdownViewer");
        let mut b = a.clone();
        a.id = "12345678-0000-4000-8000-000000000001".into();
        b.id = "12345678-0000-4000-8000-000000000002".into();
        let z = f.info("Z folder");
        let entries = WindowList::entries(vec![z, b.clone(), a.clone()], &b.id);
        assert_eq!(entries[0].info.id, a.id);
        assert_eq!(entries[1].info.id, b.id);
        assert!(entries[0].label.ends_with(&format!("[{}]", a.id)));
        assert!(!entries[0].checked);
        assert!(entries[1].checked);
        assert!(!WindowList::checked(
            &format!("viewer.instance.{}", a.id),
            &b.id
        ));
        assert!(WindowList::checked(
            &format!("viewer.instance.{}", b.id),
            &b.id
        ));
        let c = f.info("Same root");
        let d = f.info("Same root");
        let short = WindowList::entries(vec![c.clone(), d], &c.id);
        assert!(short
            .iter()
            .any(|e| e.label.ends_with(&format!("[{}]", &c.id[..8]))));
    }

    #[test]
    fn client_rejects_identity_mismatch_and_unknown_reply_version() {
        tauri::async_runtime::block_on(async {
            let f = Fixture::new();
            for wrong_version in [false, true] {
                let info = f.info("server");
                let path = f.path(&info);
                let mut response = info.clone();
                if wrong_version {
                    response.version = 999;
                } else {
                    response.id = uuid::Uuid::new_v4().to_string();
                }
                let task = f.reply_server(response, &path);
                assert!(InstanceProtocol::query(&path).await.is_err());
                task.await.unwrap();
            }
        });
    }

    #[test]
    fn stale_cleanup_only_removes_missing_or_refused_socket_and_keeps_timeout() {
        tauri::async_runtime::block_on(async {
            let f = Fixture::new();
            let info = f.info("stale");
            let path = f.path(&info);
            assert!(InstanceProtocol::query(&path).await.is_err());
            let listener = UnixListener::bind(&path).unwrap();
            drop(listener);
            assert!(path.exists());
            assert!(InstanceProtocol::query(&path).await.is_err());
            assert!(!path.exists());
            let listener = UnixListener::bind(&path).unwrap();
            assert!(tokio::time::timeout(
                Duration::from_millis(30),
                InstanceProtocol::query(&path)
            )
            .await
            .is_err());
            assert!(path.exists());
            drop(listener);
            fs::remove_file(&path).unwrap();
            fs::write(&path, "not a socket").unwrap();
            assert!(InstanceProtocol::query(&path).await.is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), "not a socket");
        });
    }

    #[test]
    fn discovery_reports_partial_results_without_discarding_healthy_peer() {
        tauri::async_runtime::block_on(async {
            let f = Fixture::new();
            let good = f.info("good");
            let silent = f.info("silent");
            let task = f.reply_server(good.clone(), &f.path(&good));
            let _listener = UnixListener::bind(f.path(&silent)).unwrap();
            let (peers, partial) =
                InstanceProtocol::discover(&f.0, Duration::from_millis(100)).await;
            assert!(partial);
            assert_eq!(peers.len(), 1);
            assert_eq!(peers[0].id, good.id);
            task.await.unwrap();
        });
    }

    #[test]
    fn independent_services_exchange_info_and_activation_and_reject_invalid_requests() {
        tauri::async_runtime::block_on(async {
            let f = Fixture::new();
            for (version, remaining, wrong_id, accepted) in [
                (1, 500, false, true),
                (1, 500, false, true),
                (999, 500, false, false),
                (1, 500, true, false),
                (1, 0, false, false),
                (1, 2001, false, false),
            ] {
                let info = f.info("independent service");
                let path = f.path(&info);
                let listener = UnixListener::bind(&path).unwrap();
                let calls = Arc::new(AtomicUsize::new(0));
                let counter = calls.clone();
                let server_info = info.clone();
                let task = tokio::spawn(async move {
                    let (stream, _) = listener.accept().await.unwrap();
                    InstanceProtocol::serve(server_info, stream, move |deadline| async move {
                        assert!(deadline > Instant::now());
                        counter.fetch_add(1, Ordering::Relaxed);
                        Ok(())
                    })
                    .await;
                });
                let (mut stream, received) = InstanceProtocol::query(&path).await.unwrap();
                assert_eq!(received.id, info.id);
                InstanceProtocol::write(
                    &mut stream,
                    &Request::Activate {
                        version,
                        remaining_ms: remaining,
                        id: if wrong_id {
                            uuid::Uuid::new_v4().to_string()
                        } else {
                            info.id
                        },
                    },
                )
                .await
                .unwrap();
                let reply = InstanceProtocol::read::<Reply>(&mut stream).await;
                assert_eq!(matches!(reply, Ok(Reply::Focused)), accepted);
                task.await.unwrap();
                assert_eq!(calls.load(Ordering::Relaxed), usize::from(accepted));
            }
            let info = f.info("bad initial version");
            let listener = UnixListener::bind(f.path(&info)).unwrap();
            let path = f.path(&info);
            let task = tokio::spawn(async move {
                let (stream, _) = listener.accept().await.unwrap();
                InstanceProtocol::serve(info, stream, |_| async {
                    panic!("invalid version must not activate")
                })
                .await;
            });
            let mut stream = UnixStream::connect(&path).await.unwrap();
            InstanceProtocol::write(&mut stream, &Request::Info { version: 999 })
                .await
                .unwrap();
            assert!(InstanceProtocol::read::<Reply>(&mut stream).await.is_err());
            task.await.unwrap();
        });
    }

    #[test]
    fn transient_accept_errors_are_retryable_but_invalid_listener_is_not() {
        assert!(InstanceDirectory::transient_accept_error(
            &std::io::Error::from_raw_os_error(libc::EMFILE)
        ));
        assert!(InstanceDirectory::transient_accept_error(
            &std::io::Error::from_raw_os_error(libc::ECONNABORTED)
        ));
        assert!(!InstanceDirectory::transient_accept_error(
            &std::io::Error::from_raw_os_error(libc::EBADF)
        ));
    }
}
