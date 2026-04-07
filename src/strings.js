const STRINGS = {
  en: {
    menu: "Menu", restart: "↺ Restart Level", showSolution: "💡 Show Solution", generateMap: "🗺️ Generate New Map", resume: "Resume Game",
    settings: "Settings", level: "Level:", minQuestChain: "Minimum Quest Chain:", diggersMemory: "Diggers (Memory Mode):", genMap: "🗺️ Generate Map", back: "Back",
    genFailedTitle: "Generation Failed", genFailedDesc: "It is mathematically impossible to generate a world with these settings.", openSettings: "Open Settings",
    generating: "Generating Realm...", dropItem: "⬇️ Drop Item", blocked: "BLOCKED!", exit: "Exit", questComplete: "Quest Complete!",
    entities: { troll: 'Troll', baker: 'Baker', spider: 'Spider', chest: 'Chest', wizard: 'Wizard', dragon: 'Dragon', dog: 'Hound', goblin: 'Goblin', mermaid: 'Mermaid', mermaid_red: 'Red Mermaid', mermaid_purple: 'Purple Mermaid', mermaid_green: 'Green Mermaid', mermaid_teal: 'Teal Mermaid', ghost: 'Ghost', knight: 'Knight', merchant: 'Merchant', fairy: 'Fairy', bear: 'Bear', miner: 'Miner', scorpion: 'Scorpion', bat: 'Vampire Bat', slime: 'Acid Slime', mole: 'Giant Mole', diver: 'Diver', crab: 'Crab', octopus: 'Octopus', seahorse: 'Seahorse', dolphin: 'Dolphin', sea_witch: 'Sea Witch', caveBoss: 'Cave Boss', vaultGate: 'Vault Gate', rock: 'Rock', giant_clam: 'Giant Clam', clam: 'Giant Clam' },
    items: { apple: 'Apple', bread: 'Bread', gold: 'Gold', gem: 'Gem', sword: 'Sword', bug_spray: 'Poison', key: 'Key', wand: 'Wand', hat: 'Hat', bone: 'Bone', shield: 'Shield', map: 'Map', lantern: 'Lantern', flute: 'Flute', flower: 'Flower', fish: 'Fish', gold_fish: 'Goldfish', crystal: 'Crystal', gold_nugget: 'Gold Nugget', mushroom: 'Mushroom', emerald: 'Emerald', relic: 'Relic', rope: 'Rope', pickaxe: 'Pickaxe', pearl: 'Pearl', shell: 'Shell', starfish: 'Starfish', trident: 'Trident', comb: 'Dinglehopper', mirror: 'Looking Glass', boot: 'Old Boot', locket: 'Golden Locket', crown: 'Glowing Crown' },
    levels: { river_crossing: 'River Crossing', underground: 'The Cave', underwater: 'Under the Sea' },
    or: "or"
  },
  he: {
    menu: "תפריט", restart: "↺ התחל מחדש", showSolution: "💡 הצג פתרון", generateMap: "🗺️ צור מפה חדשה", resume: "חזור למשחק",
    settings: "הגדרות", level: "שלב:", minQuestChain: "שרשרת משימות מינימלית:", diggersMemory: "חופרים (מצב זיכרון):", genMap: "🗺️ צור מפה", back: "חזור",
    genFailedTitle: "היצירה נכשלה", genFailedDesc: "אי אפשר מתמטית ליצור עולם עם הגדרות אלו.", openSettings: "פתח הגדרות",
    generating: "יוצר עולם...", dropItem: "⬇️ זרוק חפץ", blocked: "חסום!", exit: "יציאה", questComplete: "המסע הושלם!",
    entities: { troll: 'טרול', baker: 'אופה', spider: 'עכביש', chest: 'תיבה', wizard: 'קוסם', dragon: 'דרקון', dog: 'כלב ציד', goblin: 'גובלין', mermaid: 'בת ים', mermaid_red: 'בת ים אדומה', mermaid_purple: 'בת ים סגולה', mermaid_green: 'בת ים ירוקה', mermaid_teal: 'בת ים כחלחלה', ghost: 'רוח רפאים', knight: 'אביר', merchant: 'סוחר', fairy: 'פיה', bear: 'דוב', miner: 'כורה', scorpion: 'עקרב', bat: 'עטלף ערפד', slime: 'רפש חומצי', mole: 'חפרפרת ענק', diver: 'צוללן', crab: 'סרטן', octopus: 'תמנון', seahorse: 'סוס ים', dolphin: 'דולפין', sea_witch: 'מכשפת ים', caveBoss: 'בוס מערה', vaultGate: 'שער כספת', rock: 'סלע', giant_clam: 'צדפת ענק', clam: 'צדפת ענק' },
    items: { apple: 'תפוח', bread: 'לחם', gold: 'זהב', gem: 'יהלום', sword: 'חרב', bug_spray: 'רעל', key: 'מפתח', wand: 'שרביט', hat: 'כובע', bone: 'עצם', shield: 'מגן', map: 'מפה', lantern: 'פנס', flute: 'חליל', flower: 'פרח', fish: 'דג', gold_fish: 'דג זהב', crystal: 'קריסטל', gold_nugget: 'גוש זהב', mushroom: 'פטרייה', emerald: 'ברקת', relic: 'שריד', rope: 'חבל', pickaxe: 'מכוש', pearl: 'פנינה', shell: 'צדף', starfish: 'כוכב ים', trident: 'קלשון', comb: 'דינגלהופר', mirror: 'מראה', boot: 'מגף ישן', locket: 'תליון זהב', crown: 'כתר מואר' },
    levels: { river_crossing: 'חציית הנהר', underground: 'המערה', underwater: 'מתחת לים' },
    or: "או"
  }
};

export default STRINGS;
