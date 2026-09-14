import json
import os

log_path = r"C:\Users\Lenovo\.gemini\antigravity-ide\brain\f586bfd8-4068-41c0-9417-617c67a5c099\.system_generated\logs\transcript_full.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        content = data.get("content", "")
        if "File Path:" in content and "Covid_Web/styles.css" in content and "Total Lines: 417" in content:
            with open("recovered_styles.css", "w", encoding="utf-8") as out_f:
                lines = content.split("\n")
                for l in lines:
                    idx = l.find(": ")
                    if idx != -1 and l[:idx].isdigit():
                        out_f.write(l[idx+2:] + "\n")
            print("Successfully extracted original Covid_Web/styles.css to recovered_styles.css")
            break
