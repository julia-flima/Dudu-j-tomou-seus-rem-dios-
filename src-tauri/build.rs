use std::{env, fs, path::PathBuf};

fn main() {
    tauri_build::build();
    configurar_projeto_android();
}

/// Ajusta os arquivos Gradle gerados para o Android evitando avisos de
/// propriedades legadas do AGP 9+ e de codigo Kotlin gerado por dependencias.
fn configurar_projeto_android() {
    let Some(project_dir) = env::var_os("TAURI_ANDROID_PROJECT_PATH").map(PathBuf::from) else {
        return;
    };

    let gradle_props_path = project_dir.join("gradle.properties");
    if let Ok(mut props) = fs::read_to_string(&gradle_props_path) {
        let mut alterado = false;
        if !props.contains("android.sync.suppressAgpWarnings=") {
            if !props.ends_with('\n') {
                props.push('\n');
            }
            props.push_str(
                "android.sync.suppressAgpWarnings=UNSUPPORTED_PROJECT_OPTION_USE,DEPRECATED_DSL\n",
            );
            alterado = true;
        }
        if alterado {
            let _ = fs::write(&gradle_props_path, props);
        }
    }

    let app_build_gradle_path = project_dir.join("app").join("build.gradle.kts");
    if let Ok(conteudo) = fs::read_to_string(&app_build_gradle_path)
        && !conteudo.starts_with("@file:Suppress(")
    {
        let _ = fs::write(
            &app_build_gradle_path,
            format!("@file:Suppress(\"DEPRECATION\")\n{conteudo}"),
        );
    }

    let root_build_gradle_path = project_dir.join("build.gradle.kts");
    if let Ok(mut conteudo) = fs::read_to_string(&root_build_gradle_path)
        && !conteudo.contains("-nowarn")
    {
        if !conteudo.ends_with('\n') {
            conteudo.push('\n');
        }
        conteudo.push_str(
            r#"
subprojects {
    tasks.configureEach {
        if (name.startsWith("compile") && name.endsWith("Kotlin")) {
            try {
                val options = javaClass.getMethod("getCompilerOptions").invoke(this)
                @Suppress("UNCHECKED_CAST")
                val freeArgs = options.javaClass.getMethod("getFreeCompilerArgs").invoke(options)
                    as org.gradle.api.provider.ListProperty<String>
                freeArgs.add("-nowarn")
            } catch (_: Exception) {}
        }
    }
}
"#,
        );
        let _ = fs::write(&root_build_gradle_path, conteudo);
    }
}
