// Esconde o terminal extra no Windows em builds de release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    remedios_do_dudu_lib::run()
}
