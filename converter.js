
function convert() {
    clearNotification();
    const input = document.getElementById('regInput').value;
    if (!input.trim()) {
        showNotification('Input field is empty. Please provide REG file content.');
        return;
    }

    const lines = input.split(/\r?\n/);
    let currentPath = '';
    let output = '';

    const hiveMap = {
        'HKEY_LOCAL_MACHINE': 'HKLM:',
        'HKEY_CURRENT_USER': 'HKCU:',
        'HKEY_CLASSES_ROOT': 'HKCR:',
        'HKEY_USERS': 'HKU:',
        'HKEY_CURRENT_CONFIG': 'HKCC:'
    };

    try {
        lines.forEach((line, index) => {
            line = line.trim();
            if (line === '' || line.startsWith('Windows Registry Editor')) return;

            if (line.startsWith('[')) {
                if (!line.endsWith(']')) throw `Invalid registry key format on line ${index + 1}`;

                const section = line.slice(1, -1);
                const hiveKey = Object.keys(hiveMap).find(hive => section.startsWith(hive));
                if (!hiveKey) throw `Unknown registry hive on line ${index + 1}`;

                currentPath = section.replace(hiveKey, hiveMap[hiveKey]);
                output += `New-Item -Path '${currentPath}' -Force\n`;
            } else {
                if (!currentPath) throw `Value outside of registry path on line ${index + 1}`;
                if (!line.includes('=')) throw `Missing '=' on line ${index + 1}`;

                const [namePart, valuePartRaw] = line.split('=');
                const name = namePart.replace(/^"|"$/g, '');
                const valuePart = valuePartRaw.trim();

                let value = '';
                let type = '';

                if (valuePart.startsWith('dword:')) {
                    type = 'DWord';
                    value = parseInt(valuePart.replace('dword:', ''), 16);
                    if (isNaN(value)) throw `Invalid DWORD value on line ${index + 1}`;
                } else if (valuePart.startsWith('hex(7):')) {
                    type = 'MultiString';
                    const hexValues = valuePart.replace('hex(7):', '').split(',').map(h => parseInt(h, 16));
                    const utf16str = hexToUtf16String(hexValues);
                    const multiStrings = utf16str.split('\u0000').filter(s => s);
                    value = '@("' + multiStrings.join('","') + '")';
                } else if (valuePart.startsWith('hex(2):')) {
                    type = 'ExpandString';
                    const hexValues = valuePart.replace('hex(2):', '').split(',').map(h => parseInt(h, 16));
                    const utf16str = hexToUtf16String(hexValues);
                    value = `"${utf16str.replace(/\u0000/g, '')}"`;
                } else if (valuePart.startsWith('hex:')) {
                    type = 'Binary';
                    value = '"' + valuePart.replace(/^hex:/, '').replace(/,/g, '') + '"';
                } else if (valuePart.startsWith('"') && valuePart.endsWith('"')) {
                    type = 'String';
                    value = `'${valuePart.replace(/^"|"$/g, '')}'`;
                } else {
                    type = 'String';
                    value = `'${valuePart}'`;
                }

                output += `Set-ItemProperty -Path '${currentPath}' -Name '${name}' -Value ${value} -Type ${type}\n`;
            }
        });

        document.getElementById('psOutput').textContent = output;
        document.getElementById('psOutput').dataset.raw = output;

    } catch (err) {
        showNotification(err);
    }
}

function hexToUtf16String(hexArray) {
    let chars = [];
    for (let i = 0; i < hexArray.length; i += 2) {
        if (i + 1 < hexArray.length) {
            const code = (hexArray[i+1] << 8) + hexArray[i];
            chars.push(String.fromCharCode(code));
        }
    }
    return chars.join('');
}

function copyOutput() {
    const temp = document.createElement('textarea');
    temp.value = document.getElementById('psOutput').dataset.raw;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    showNotification("Output copied to clipboard!", "success");
}

function clearAll() {
    document.getElementById('regInput').value = '';
    document.getElementById('psOutput').textContent = '';
    clearNotification();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('regInput').value = e.target.result;
    };
    reader.readAsText(file);
}

function downloadOutput() {
    const text = "# Script generated with Justin Verstijnen Registry to PowerShell tool on https://reg2ps.jvapp.nl\n\n"
               + document.getElementById('psOutput').dataset.raw;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-script.ps1';
    a.click();
    URL.revokeObjectURL(url);
}

function showNotification(message, type = "error") {
    const box = document.getElementById("notification");
    box.textContent = message;
    box.style.display = "block";
    box.style.backgroundColor = type === "success" ? "#d4edda" : "#f8d7da";
    box.style.color = type === "success" ? "#155724" : "#721c24";
    box.style.borderColor = type === "success" ? "#c3e6cb" : "#f5c6cb";
}

function clearNotification() {
    const box = document.getElementById("notification");
    box.style.display = "none";
}
