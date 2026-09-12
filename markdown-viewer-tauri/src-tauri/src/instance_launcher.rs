use super::*;
use std::sync::atomic::AtomicBool;

#[derive(Default)]
pub(crate) struct InstanceLauncher {
    launching: AtomicBool,
}
struct LaunchGuard<'a>(&'a AtomicBool);
impl Drop for LaunchGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl InstanceLauncher {
    pub fn launch(&self) -> Result<(), ViewerError> {
        if self
            .launching
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(ViewerError::new(
                "launch",
                "A new window is already being launched.",
            ));
        }
        let _guard = LaunchGuard(&self.launching);
        let exe = std::env::current_exe().map_err(|e| ViewerError::new("launch", e.to_string()))?;
        #[cfg(target_os = "macos")]
        if let Some(bundle) = Self::bundle_path(&exe)? {
            let output = Command::new("/usr/bin/open")
                .args(["-n", "-a"])
                .arg(&bundle)
                .stdin(Stdio::null())
                .output()
                .map_err(|e| ViewerError::new("launch", e.to_string()))?;
            return if output.status.success() {
                Ok(())
            } else {
                Err(ViewerError::new(
                    "launch",
                    format!(
                        "Failed to launch {}: {}",
                        bundle.display(),
                        String::from_utf8_lossy(&output.stderr)
                    ),
                ))
            };
        }
        let mut command = Command::new(exe);
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW: GUI binaryの親consoleを継承しない。
        let mut child = command
            .spawn()
            .map_err(|e| ViewerError::new("launch", e.to_string()))?;
        thread::spawn(move || {
            if let Err(e) = child.wait() {
                eprintln!("Failed to reap Viewer process: {e}");
            }
        });
        Ok(())
    }
    #[cfg(target_os = "macos")]
    fn bundle_path(exe: &Path) -> Result<Option<PathBuf>, ViewerError> {
        let Some(macos) = exe
            .parent()
            .filter(|p| p.file_name().is_some_and(|n| n == "MacOS"))
        else {
            return Ok(None);
        };
        let Some(contents) = macos
            .parent()
            .filter(|p| p.file_name().is_some_and(|n| n == "Contents"))
        else {
            return Ok(None);
        };
        let bundle = contents
            .parent()
            .ok_or_else(|| ViewerError::new("launch", "Invalid application bundle."))?;
        if bundle.extension().is_none_or(|e| e != "app") || !contents.join("Info.plist").is_file() {
            return Err(ViewerError::new(
                "launch",
                format!("Invalid application bundle: {}", bundle.display()),
            ));
        }
        Ok(Some(bundle.to_path_buf()))
    }
}
