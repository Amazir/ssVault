// DOM helper functions
export const qs = (sel, root = document) => root.querySelector(sel);
export const byId = (id) => document.getElementById(id);
export const getTemplate = (id) => byId(id).content.firstElementChild;

// Type metadata for different entity types
export const typeMeta = {
    passwords: {
        singular: 'password',
        emptyTitle: 'No passwords yet',
        emptyDesc: 'Use the button below to add your first password.'
    },
    files: {
        singular: 'file',
        emptyTitle: 'No files yet',
        emptyDesc: 'Use the button below to add your first file.'
    },
    gpg: {
        singular: 'gpg',
        emptyTitle: 'No GPG keys yet',
        emptyDesc: 'Use the button below to add your first GPG key.'
    },
    groups: {
        singular: 'group',
        emptyTitle: 'No groups yet',
        emptyDesc: 'Use the button below to add your first group.'
    }
};

// Sort data by key
export function sortByKey(data, key, dir = 'asc') {
    const factor = dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        let va = a[key];
        let vb = b[key];

        if (typeof va === 'number' && typeof vb === 'number') {
            return (va - vb) * factor;
        }

        va = (va ?? '').toString().toLowerCase();
        vb = (vb ?? '').toString().toLowerCase();
        if (va < vb) return -1 * factor;
        if (va > vb) return 1 * factor;
        return 0;
    });
}

// Map file type from filename
export function mapFileTypeFromName(filename = '') {
    const lower = filename.toLowerCase();

    if (/\.(png|jpe?g|gif|webp|bmp|tiff?|svg|heic|heif|ico)$/.test(lower)) return 'Image';
    if (/\.(mp4|m4v|mkv|mov|avi|wmv|flv|webm|mpeg|mpg|3gp)$/.test(lower)) return 'Video';
    if (/\.(mp3|wav|flac|aac|ogg|m4a|wma|opus)$/.test(lower)) return 'Audio';
    if (/\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso|dmg)$/.test(lower)) return 'Archive';
    if (/\.(txt|md|rtf|log)$/.test(lower)) return 'Text';
    if (/\.(pdf)$/.test(lower)) return 'PDF';
    if (/\.(docx?|odt|rtf)$/.test(lower)) return 'Document';
    if (/\.(xlsx?|ods|csv|tsv)$/.test(lower)) return 'Spreadsheet';
    if (/\.(pptx?|odp)$/.test(lower)) return 'Presentation';
    if (/\.(js|ts|jsx|tsx|java|c|cpp|cs|go|rs|py|php|rb|swift|kt|sql|html|css|json|yml|yaml|xml|ini|cfg|env)$/.test(lower)) return 'Code/Config';
    if (/\.(db|sqlite|sqlite3|bak|bin|dat)$/.test(lower)) return 'Data';
    return 'Other';
}
