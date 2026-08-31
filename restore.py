import os

files = ['Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

missing_string = """                    }).showToast();
                }
            } catch (err) {
                console.error("Error descargando:", err);
                alert("Hubo un error al generar el Excel.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }, 50);"""

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to replace "\n\n    },\n\n    /**\n     * Reinicia el módulo"
    # with "\n" + missing_string + "\n    },\n\n    /**\n     * Reinicia el módulo"
    
    if missing_string not in content:
        content = content.replace("\n\n    },\n\n    /**\n     * Reinicia el módulo", "\n" + missing_string + "\n    },\n\n    /**\n     * Reinicia el módulo")
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Restored {f}")
    else:
        print(f"String already exists in {f}")
