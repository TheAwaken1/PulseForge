use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub total_frames: u32,
    pub audio_path: String,
    pub output_path: String,
    #[serde(default)]
    pub mode: ExportMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExportMode {
    #[default]
    Compatibility,
    Crisp,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportStatus {
    pub running: bool,
    pub frame: u32,
    pub total_frames: u32,
    pub percent: f64,
}

pub struct ExportState {
    process: Arc<Mutex<Option<Child>>>,
    stdin_writer: Arc<Mutex<Option<std::process::ChildStdin>>>,
    stderr_buffer: Arc<Mutex<Vec<u8>>>,
    status: Arc<Mutex<ExportStatus>>,
    settings: Arc<Mutex<Option<ExportSettings>>>,
}

impl Default for ExportState {
    fn default() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            stdin_writer: Arc::new(Mutex::new(None)),
            stderr_buffer: Arc::new(Mutex::new(Vec::new())),
            status: Arc::new(Mutex::new(ExportStatus {
                running: false,
                frame: 0,
                total_frames: 0,
                percent: 0.0,
            })),
            settings: Arc::new(Mutex::new(None)),
        }
    }
}

/// Locate the ffmpeg binary. Checks for sidecar first, then system PATH.
fn find_ffmpeg() -> String {
    // In production, Tauri bundles it as a sidecar.
    // In development, fall back to system ffmpeg.
    "ffmpeg".to_string()
}

#[tauri::command]
pub async fn start_export(
    settings: ExportSettings,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let ffmpeg_path = find_ffmpeg();
    if let Some(parent) = std::path::Path::new(&settings.output_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }
    }

    let keyint = std::cmp::max(1, settings.fps.saturating_mul(2));
    let is_crisp = settings.mode == ExportMode::Crisp;
    // yuv420p requires even dimensions; enforce for both modes.
    let needs_scale = settings.width % 2 != 0 || settings.height % 2 != 0;

    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-pix_fmt".to_string(),
        "rgba".to_string(),
        "-s".to_string(),
        format!("{}x{}", settings.width, settings.height),
        "-r".to_string(),
        settings.fps.to_string(),
        "-i".to_string(),
        "pipe:0".to_string(),
        "-i".to_string(),
        settings.audio_path.clone(),
        // H.264 with High profile + yuv420p: universally decodable, fully seekable.
        // high444/yuv444p (Hi444PP) is NOT supported by most hardware decoders and
        // breaks seeking/pausing in virtually all consumer media players.
        "-c:v".to_string(),
        "libx264".to_string(),
        "-profile:v".to_string(),
        "high".to_string(),
        "-tune".to_string(),
        "animation".to_string(),
        "-preset".to_string(),
        "slow".to_string(),
        "-g".to_string(),
        keyint.to_string(),
        "-keyint_min".to_string(),
        keyint.to_string(),
        "-sc_threshold".to_string(),
        "0".to_string(),
        "-r".to_string(),
        settings.fps.to_string(),
        // yuv420p is required for broad hardware decoder compatibility.
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
    ];

    // CRF: crisp = higher quality (lower number), compatibility = balanced.
    if is_crisp {
        args.extend(["-crf".to_string(), "14".to_string()]);
    } else {
        args.extend(["-crf".to_string(), "18".to_string()]);
    }

    // Even-dimension guard required for yuv420p.
    if needs_scale {
        args.push("-vf".to_string());
        args.push("scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos".to_string());
    }

    args.extend([
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-shortest".to_string(),
        // Move moov atom to front of file so the video is seekable immediately.
        "-movflags".to_string(),
        "+faststart".to_string(),
    ]);
    args.push(settings.output_path.clone());

    let mut child = Command::new(&ffmpeg_path)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to open ffmpeg stdin")?;

    // Store in app state
    let state = app.state::<ExportState>();
    *state.process.lock().unwrap() = Some(child);
    *state.stdin_writer.lock().unwrap() = Some(stdin);
    *state.settings.lock().unwrap() = Some(settings.clone());
    state.stderr_buffer.lock().unwrap().clear();
    *state.status.lock().unwrap() = ExportStatus {
        running: true,
        frame: 0,
        total_frames: settings.total_frames,
        percent: 0.0,
    };

    Ok("Export started".to_string())
}

#[tauri::command]
pub async fn write_export_frame(
    frame: Vec<u8>,
    frame_index: u32,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let state = app.state::<ExportState>();
    let settings = state.settings.lock().unwrap().clone().ok_or("Export settings not initialized")?;
    let expected_bytes = (settings.width as usize)
        .saturating_mul(settings.height as usize)
        .saturating_mul(4);
    if frame.len() != expected_bytes {
        return Err(format!(
            "Invalid frame size: got {} bytes, expected {} ({}x{} RGBA)",
            frame.len(),
            expected_bytes,
            settings.width,
            settings.height
        ));
    }

    {
        let mut stdin_guard = state.stdin_writer.lock().unwrap();
        let stdin = stdin_guard.as_mut().ok_or("FFmpeg stdin is unavailable")?;
        stdin
            .write_all(&frame)
            .map_err(|e| format!("Failed to write frame to ffmpeg: {}", e))?;
    }

    let total = settings.total_frames.max(1);
    let frame_clamped = frame_index.min(total);
    *state.status.lock().unwrap() = ExportStatus {
        running: true,
        frame: frame_clamped,
        total_frames: settings.total_frames,
        percent: (frame_clamped as f64 / total as f64) * 100.0,
    };

    Ok(())
}

#[tauri::command]
pub async fn finalize_export(app: tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<ExportState>();
    let settings = state.settings.lock().unwrap().clone();

    // Drop stdin to signal EOF so ffmpeg can finish muxing.
    let _ = state.stdin_writer.lock().unwrap().take();

    let output = if let Some(proc) = state.process.lock().unwrap().take() {
        proc.wait_with_output()
            .map_err(|e| format!("Failed waiting for ffmpeg: {}", e))?
    } else {
        return Err("No active ffmpeg process".to_string());
    };

    {
        let mut stderr_buf = state.stderr_buffer.lock().unwrap();
        stderr_buf.clear();
        stderr_buf.extend_from_slice(&output.stderr);
    }

    let total = settings.as_ref().map(|s| s.total_frames).unwrap_or(0);
    *state.status.lock().unwrap() = ExportStatus {
        running: false,
        frame: total,
        total_frames: total,
        percent: if total > 0 { 100.0 } else { 0.0 },
    };
    *state.settings.lock().unwrap() = None;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail = stderr.lines().rev().take(15).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
        return Err(format!("ffmpeg failed with status {}:\n{}", output.status, tail));
    }

    Ok("Export finalized".to_string())
}

#[tauri::command]
pub async fn cancel_export(app: tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<ExportState>();

    // Drop stdin to signal EOF
    let _ = state.stdin_writer.lock().unwrap().take();

    // Kill the process
    if let Some(mut proc) = state.process.lock().unwrap().take() {
        let _ = proc.kill();
        let _ = proc.wait();
    }

    *state.status.lock().unwrap() = ExportStatus {
        running: false,
        frame: 0,
        total_frames: 0,
        percent: 0.0,
    };
    *state.settings.lock().unwrap() = None;

    Ok("Export cancelled".to_string())
}

#[tauri::command]
pub async fn get_export_status(app: tauri::AppHandle) -> Result<ExportStatus, String> {
    let state = app.state::<ExportState>();
    let status = state.status.lock().unwrap().clone();
    Ok(status)
}
