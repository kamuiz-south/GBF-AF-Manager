const fs = require('fs');
const path = require('path');

const tabsDir = path.join(__dirname, 'src', 'tabs');
let files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx')).map(f => path.join(tabsDir, f));

files.push(path.join(__dirname, 'src', 'App.tsx'));
files.push(path.join(__dirname, 'src', 'components', 'SkillCell.tsx'));
files.push(path.join(__dirname, 'src', 'components', 'SkillRow.tsx'));

const fullPaths = files.filter(f => fs.existsSync(f));

fullPaths.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    const replacer = (match, p1) => {
        const val = parseFloat(p1);
        if (val >= 1.0 && val <= 1.1) return `fontSize: 'var(--font-size-main)'`;
        if (val > 1.1) return `fontSize: 'calc(var(--font-size-main) * ${val})'`;
        if (val >= 0.88 && val <= 0.99) return `fontSize: 'var(--font-size-main)'`;
        if (val >= 0.8 && val <= 0.87) return `fontSize: 'var(--font-size-sub)'`;
        if (val < 0.8) {
            const ratio = (val / 0.8).toFixed(2);
            return `fontSize: 'calc(var(--font-size-sub) * ${ratio})'`;
        }
        return match;
    };

    content = content.replace(/fontSize:\s*'([0-9.]+)rem'/g, replacer);
    content = content.replace(/fontSize:\s*"([0-9.]+)rem"/g, replacer);

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
