const fs = require('fs');
const path = require('path');

const tabsDir = path.join(__dirname, 'src', 'tabs');
const files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx'));

files.push('../App.tsx');
files.push('../components/SkillCell.tsx'); // if exists
files.push('../components/SkillRow.tsx'); // if exists

const fullPaths = files.map(f => path.join(tabsDir, f)).filter(f => fs.existsSync(f));

fullPaths.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Replace fontSize: 'Xrem' with calc and vars
    // 0.85rem -> var(--font-size-sub)
    // 0.8rem -> var(--font-size-sub)
    // 0.7rem, 0.75rem -> calc(var(--font-size-sub) * 0.85)
    // 0.9rem, 0.95rem -> var(--font-size-main)
    // > 1rem -> calc(var(--font-size-main) * X)

    content = content.replace(/fontSize:\s*'([0-9.]+)rem'/g, (match, p1) => {
        const val = parseFloat(p1);
        if (val >= 1.0 && val <= 1.1) return `fontSize: 'var(--font-size-main)'`;
        if (val > 1.1) return `fontSize: 'calc(var(--font-size-main) * ${val})'`;
        if (val >= 0.88 && val <= 0.99) return `fontSize: 'var(--font-size-main)'`;
        if (val >= 0.8 && val <= 0.87) return `fontSize: 'var(--font-size-sub)'`;
        if (val < 0.8) return `fontSize: 'calc(var(--font-size-sub) * ${val / 0.8})'`;
        return match;
    });

    // Replace fontSize: "Xrem" just in case
    content = content.replace(/fontSize:\s*"([0-9.]+)rem"/g, (match, p1) => {
        const val = parseFloat(p1);
        if (val >= 1.0 && val <= 1.1) return `fontSize: 'var(--font-size-main)'`;
        if (val > 1.1) return `fontSize: 'calc(var(--font-size-main) * ${val})'`;
        if (val >= 0.88 && val <= 0.99) return `fontSize: 'var(--font-size-main)'`;
        if (val >= 0.8 && val <= 0.87) return `fontSize: 'var(--font-size-sub)'`;
        if (val < 0.8) return `fontSize: 'calc(var(--font-size-sub) * ${val / 0.8})'`;
        return match;
    });

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
});
