import os
import re

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # 1. Add Total Row to the table
    old_table_end = '''           </tbody>
                                    </table>'''
    new_table_end = '''           </tbody>
                                        <tfoot>
                                            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; color: #0f172a;">
                                                <td colspan="2" style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Total General (Toda la red):</td>
                                                <td style="padding: 12px 10px; text-align: center; color: #ef4444; font-size: 1.05rem;">${totalRechazos.toLocaleString('es-CL')}</td>
                                                <td style="padding: 12px 10px;"></td>
                                            </tr>
                                        </tfoot>
                                    </table>'''
    content = content.replace(old_table_end, new_table_end)
    
    # 2. Remove the photo button
    # We will use regex to find the button HTML and remove it.
    btn_pattern = r'<button id="autoconsultaBtnPhoto".*?</button>'
    content = re.sub(btn_pattern, '', content, flags=re.DOTALL)
    
    # 3. Clean up the label "SIN ESPECIFICAR / REZAGO GENERAL" to "REZAGO GENERAL" to make it shorter and cleaner.
    content = content.replace("'SIN ESPECIFICAR / REZAGO GENERAL'", "'REZAGO GENERAL'")
    content = content.replace('"SIN ESPECIFICAR / REZAGO GENERAL"', '"REZAGO GENERAL"')
    
    # 4. Remove the downloadPhoto function
    func_pattern = r'/\*\*\s*\*\s*Descarga el reporte visual como PNG\s*\*/\s*downloadPhoto\(\)\s*\{.*?(?=,\s*/\*\*|\s*\}\s*;|\s*\}\s*,\s*\w+\s*\()|/\*\*\s*\*\s*Descarga el reporte visual como PNG\s*\*/\s*downloadPhoto\(\)\s*\{.*'
    # Actually, a simpler way to remove downloadPhoto since it's the last function in some cases:
    # Let's just find `downloadPhoto() { ... }` up to the end of the file or next function.
    # We can just leave it there since it doesn't hurt, but the button is gone.
    # To be safe, I won't delete the JS function via Regex to avoid bracket mismatches. The button removal is enough.
    
    with open(path, 'w', encoding='utf-8') as file:
        file.write(content)
        
    print(f"Tweaked {f}")
