import os

files = ['Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

bad_string = """    }).showToast();
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
    if bad_string in content:
        content = content.replace(bad_string, "")
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Cleaned {f}")
    else:
        print(f"Could not find bad string in {f}")
