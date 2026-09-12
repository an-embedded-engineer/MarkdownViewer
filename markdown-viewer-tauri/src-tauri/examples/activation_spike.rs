//! Phase 3の成立性検証専用。通常Viewerにテスト用commandを公開しない。
#[cfg(target_os = "macos")]
mod macos {
    use objc2::{available, MainThreadMarker};
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationOptions, NSRunningApplication, NSWindow,
    };
    use serde::{Deserialize, Serialize};
    use std::path::PathBuf;
    use std::sync::{mpsc, Arc, Mutex};
    use std::time::{Duration, Instant};
    use tauri::Manager;

    #[derive(Clone, Deserialize)]
    struct Command {
        sequence: u64,
        action: String,
        pid: Option<i32>,
    }

    #[derive(Default, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Snapshot {
        pid: u32,
        sequence: u64,
        active: bool,
        key: bool,
        minimized: bool,
        fullscreen: bool,
        on_active_space: bool,
        error: Option<String>,
        handoff_accepted: Option<bool>,
        #[serde(skip)]
        activating: Option<Instant>,
    }

    struct Probe {
        snapshot: Snapshot,
    }

    impl Probe {
        fn tick(&mut self, window: &tauri::WebviewWindow, command: Option<Command>) {
            let mtm = MainThreadMarker::new().expect("probe runs on main thread");
            let app = NSApplication::sharedApplication(mtm);
            let pointer = window.ns_window().expect("native window") as *const NSWindow;
            // SAFETY: Tauri owns the live NSWindow; it is accessed only within this main-thread tick.
            let native = unsafe { &*pointer };
            if let Some(command) = command.filter(|c| c.sequence > self.snapshot.sequence) {
                self.snapshot.sequence = command.sequence;
                self.snapshot.error = None;
                match command.action.as_str() {
                    "yield" | "yield-explicit" => {
                        if !app.isActive() {
                            self.snapshot.error = Some("Requester is not active.".into());
                        } else if let Some(target) = command
                            .pid
                            .and_then(NSRunningApplication::runningApplicationWithProcessIdentifier)
                        {
                            if available!(macos = 14.0) {
                                app.yieldActivationToApplication(&target);
                                if command.action == "yield-explicit" {
                                    self.snapshot.handoff_accepted =
                                        Some(target.activateFromApplication_options(
                                            &NSRunningApplication::currentApplication(),
                                            NSApplicationActivationOptions::ActivateAllWindows,
                                        ));
                                }
                            }
                        } else {
                            self.snapshot.error = Some("Target process is not running.".into());
                        }
                    }
                    "activate" => {
                        app.unhide(None);
                        if native.isMiniaturized() {
                            native.deminiaturize(None);
                        }
                        self.snapshot.activating = Some(Instant::now());
                    }
                    "minimize" => {
                        if let Err(error) = window.minimize() {
                            self.snapshot.error = Some(error.to_string());
                        }
                    }
                    "fullscreen" | "normal" => {
                        if let Err(error) = window.set_fullscreen(command.action == "fullscreen") {
                            self.snapshot.error = Some(error.to_string());
                        }
                    }
                    "exit" => window.app_handle().exit(0),
                    _ => self.snapshot.error = Some("Unknown probe action.".into()),
                }
            }
            if let Some(started) = self.snapshot.activating {
                if started.elapsed() >= Duration::from_secs(2) {
                    self.snapshot.error = Some("Activation deadline exceeded.".into());
                    self.snapshot.activating = None;
                } else if !native.isMiniaturized() {
                    native.makeKeyAndOrderFront(None);
                    if available!(macos = 14.0) {
                        app.activate();
                    } else {
                        #[allow(deprecated)]
                        app.activateIgnoringOtherApps(true);
                    }
                    if native.isKeyWindow() && app.isActive() {
                        self.snapshot.activating = None;
                    }
                }
            }
            self.snapshot.pid = std::process::id();
            self.snapshot.active = app.isActive();
            self.snapshot.key = native.isKeyWindow();
            self.snapshot.minimized = native.isMiniaturized();
            self.snapshot.fullscreen = window.is_fullscreen().unwrap_or(false);
            self.snapshot.on_active_space = native.isOnActiveSpace();
        }
    }

    pub fn run() {
        let mut args = std::env::args().skip(1);
        let role = args.next().expect("role");
        assert!(role == "a" || role == "b");
        let directory = PathBuf::from(args.next().expect("probe directory"));
        assert!(directory.is_dir());
        let mut context = tauri::generate_context!();
        context.config_mut().app.windows.clear();
        tauri::Builder::default()
            .setup(move |app| {
                let window = tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::External("about:blank".parse()?),
                )
                .title(format!("Activation Spike {role}"))
                .inner_size(500.0, 350.0)
                .build()?;
                let probe = Arc::new(Mutex::new(Probe {
                    snapshot: Snapshot::default(),
                }));
                let handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    let command = std::fs::read(directory.join(format!("command-{role}.json")))
                        .ok()
                        .and_then(|bytes| serde_json::from_slice::<Command>(&bytes).ok());
                    let probe = probe.clone();
                    let window = window.clone();
                    let (send, receive) = mpsc::sync_channel(1);
                    if handle
                        .run_on_main_thread(move || {
                            let mut probe = probe.lock().expect("probe state");
                            probe.tick(&window, command);
                            let _ = send.send(serde_json::to_vec(&probe.snapshot));
                        })
                        .is_err()
                    {
                        break;
                    }
                    match receive.recv_timeout(Duration::from_secs(3)) {
                        Ok(Ok(bytes)) => {
                            let temp = directory.join(format!("state-{role}.tmp"));
                            if std::fs::write(&temp, bytes).is_err()
                                || std::fs::rename(
                                    temp,
                                    directory.join(format!("state-{role}.json")),
                                )
                                .is_err()
                            {
                                break;
                            }
                        }
                        _ => break,
                    }
                    std::thread::sleep(Duration::from_millis(25));
                });
                Ok(())
            })
            .run(context)
            .expect("activation probe failed");
    }
}

fn main() {
    #[cfg(target_os = "macos")]
    macos::run();
    #[cfg(not(target_os = "macos"))]
    eprintln!("This activation probe requires macOS.");
}
