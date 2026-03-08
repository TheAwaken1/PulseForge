mod ffmpeg;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ffmpeg::ExportState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            ffmpeg::start_export,
            ffmpeg::write_export_frame,
            ffmpeg::finalize_export,
            ffmpeg::cancel_export,
            ffmpeg::get_export_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
