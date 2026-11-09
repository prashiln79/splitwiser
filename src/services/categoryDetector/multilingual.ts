import { ExpenseCategory } from './types';
import { containsPhrase, containsWord, normalizeText } from './normalizer';

export interface MultilingualEntry {
  lang: string;
  category: ExpenseCategory;
  terms: string[];
}

export const MULTILINGUAL_DICTIONARY: MultilingualEntry[] = [
  // ── Spanish (es) ──
  { lang: 'es', category: 'Food', terms: ['almuerzo', 'cena', 'comida', 'restaurante', 'desayuno', 'tacos', 'tapas', 'hamburguesa', 'mariscos', 'pizzeria'] },
  { lang: 'es', category: 'Coffee', terms: ['cafeteria', 'cafe con leche', 'descafeinado', 'merienda'] },
  { lang: 'es', category: 'Drinks', terms: ['cerveza', 'vino', 'copas', 'coctel', 'discoteca', 'tragos'] },
  { lang: 'es', category: 'Transport', terms: ['autobus', 'tren', 'metro', 'taxi', 'boleto', 'peaje', 'estacionamiento'] },
  { lang: 'es', category: 'Fuel', terms: ['gasolina', 'combustible', 'gasolinera'] },
  { lang: 'es', category: 'Groceries', terms: ['supermercado', 'tienda', 'mercado', 'frutas', 'verduras', 'abarrotes'] },
  { lang: 'es', category: 'Travel', terms: ['vuelo', 'hotel', 'alojamiento', 'billete de avion', 'hospedaje', 'vacaciones'] },
  { lang: 'es', category: 'Rent', terms: ['alquiler', 'arriendo', 'fianza', 'departamento'] },
  { lang: 'es', category: 'Utilities', terms: ['electricidad', 'recarga', 'factura de luz', 'factura de agua', 'luz y gas'] },
  { lang: 'es', category: 'Health', terms: ['farmacia', 'medico', 'dentista', 'medicamento', 'hospital'] },
  { lang: 'es', category: 'Entertainment', terms: ['cine', 'teatro', 'concierto', 'entradas'] },

  // ── Brazilian Portuguese (pt) ──
  { lang: 'pt', category: 'Food', terms: ['almoco', 'jantar', 'refeicao', 'restaurante', 'lanche', 'padaria', 'churrasco', 'picanha', 'rodizio'] },
  { lang: 'pt', category: 'Coffee', terms: ['cafeteria', 'cafe da manha', 'cafezinho'] },
  { lang: 'pt', category: 'Drinks', terms: ['cerveja', 'chope', 'chopp', 'caipirinha', 'balada', 'boteco', 'barzinho'] },
  { lang: 'pt', category: 'Transport', terms: ['onibus', 'metro', 'pedagio', 'estacionamento', 'passagem'] },
  { lang: 'pt', category: 'Fuel', terms: ['gasolina', 'combustivel', 'posto de gasolina', 'etanol'] },
  { lang: 'pt', category: 'Groceries', terms: ['supermercado', 'sacolao', 'hortifruti', 'feira', 'feira livre', 'mercado'] },
  { lang: 'pt', category: 'Travel', terms: ['viagem', 'pousada', 'hotel', 'passagem aerea', 'hospedagem'] },
  { lang: 'pt', category: 'Rent', terms: ['aluguel', 'condominio', 'iptu'] },
  { lang: 'pt', category: 'Utilities', terms: ['conta de luz', 'conta de agua', 'energia eletrica', 'internet fibra'] },
  { lang: 'pt', category: 'Health', terms: ['farmacia', 'drogaria', 'medico', 'remedio', 'dentista', 'consulta medica'] },

  // ── French (fr) ──
  { lang: 'fr', category: 'Food', terms: ['dejeuner', 'diner', 'repas', 'nourriture', 'boulangerie', 'bistrot', 'brasserie', 'creperie'] },
  { lang: 'fr', category: 'Coffee', terms: ['cafe au lait', 'croissant', 'salon de the'] },
  { lang: 'fr', category: 'Drinks', terms: ['biere', 'vin rouge', 'vin blanc', 'apero', 'cocktail', 'soiree'] },
  { lang: 'fr', category: 'Transport', terms: ['metro', 'train', 'billet de train', 'autobus', 'peage', 'stationnement'] },
  { lang: 'fr', category: 'Fuel', terms: ['essence', 'carburant', 'station service', 'gazole'] },
  { lang: 'fr', category: 'Groceries', terms: ['supermarche', 'epicerie', 'fruits et legumes', 'marche'] },
  { lang: 'fr', category: 'Travel', terms: ['vol', 'avion', 'hebergement', 'vacances', 'sejour'] },
  { lang: 'fr', category: 'Rent', terms: ['loyer', 'caution', 'charges locatives'] },
  { lang: 'fr', category: 'Utilities', terms: ['electricite', 'facture edf', 'facture d\'eau', 'abonnement internet'] },
  { lang: 'fr', category: 'Health', terms: ['pharmacie', 'medecin', 'dentiste', 'medicament'] },

  // ── Indonesian (id) ──
  { lang: 'id', category: 'Food', terms: ['makan siang', 'makan malam', 'sarapan', 'warung', 'warteg', 'nasi goreng', 'mie goreng', 'restoran', 'kuliner'] },
  { lang: 'id', category: 'Coffee', terms: ['kopi', 'kedai kopi', 'kopi susu'] },
  { lang: 'id', category: 'Drinks', terms: ['bir', 'minuman'] },
  { lang: 'id', category: 'Transport', terms: ['kereta', 'pesawat', 'angkot', 'ojek', 'tol', 'parkir', 'bensin', 'ongkir'] },
  { lang: 'id', category: 'Groceries', terms: ['pasar', 'belanjaan', 'sembako', 'sayur', 'buah', 'minimarket'] },
  { lang: 'id', category: 'Rent', terms: ['kos', 'kost', 'sewa rumah', 'kontrakan'] },
  { lang: 'id', category: 'Utilities', terms: ['listrik', 'token listrik', 'tagihan air', 'pulsa', 'kuota internet'] },
  { lang: 'id', category: 'Health', terms: ['apotek', 'obat', 'dokter', 'puskesmas'] },

  // ── Mandarin Chinese (zh) ──
  { lang: 'zh', category: 'Food', terms: ['午餐', '晚餐', '早饭', '早餐', '外卖', '火锅', '烤肉', '快餐', '餐厅', '吃饭'] },
  { lang: 'zh', category: 'Coffee', terms: ['咖啡', '奶茶', '下午茶'] },
  { lang: 'zh', category: 'Drinks', terms: ['啤酒', '酒吧', '白酒', '红酒', '洋酒', '鸡尾酒'] },
  { lang: 'zh', category: 'Transport', terms: ['出租车', '打车', '地铁', '高铁', '公交车', '过路费', '停车费'] },
  { lang: 'zh', category: 'Fuel', terms: ['加油', '汽油', '加油站'] },
  { lang: 'zh', category: 'Groceries', terms: ['超市', '买菜', '生鲜', '菜市场', '便利店'] },
  { lang: 'zh', category: 'Travel', terms: ['酒店', '机票', '住宿', '旅游', '门票'] },
  { lang: 'zh', category: 'Rent', terms: ['房租', '押金', '中介费'] },
  { lang: 'zh', category: 'Utilities', terms: ['水费', '电费', '话费', '宽带', '燃气费'] },
  { lang: 'zh', category: 'Health', terms: ['药店', '医院', '买药', '挂号费', '看病'] },

  // ── Japanese (ja) ──
  { lang: 'ja', category: 'Food', terms: ['ランチ', 'ディナー', '朝食', '外食', '居酒屋', 'ラーメン', '寿司', '弁当', 'レストラン'] },
  { lang: 'ja', category: 'Coffee', terms: ['カフェ', '喫茶店', 'コーヒー'] },
  { lang: 'ja', category: 'Drinks', terms: ['ビール', '飲み会', '日本酒', 'ワイン'] },
  { lang: 'ja', category: 'Transport', terms: ['電車', 'バス', 'タクシー', '新幹線', '定期券', '駐車場'] },
  { lang: 'ja', category: 'Fuel', terms: ['ガソリン', '給油'] },
  { lang: 'ja', category: 'Groceries', terms: ['スーパー', '食料品', '八百屋', 'コンビニ'] },
  { lang: 'ja', category: 'Travel', terms: ['ホテル', '旅館', '航空券', '旅行'] },
  { lang: 'ja', category: 'Rent', terms: ['家賃', '敷金', '礼金'] },
  { lang: 'ja', category: 'Utilities', terms: ['電気代', '水道代', 'ガス代', '携帯代'] },
  { lang: 'ja', category: 'Health', terms: ['薬局', '病院', 'クリニック', '処方箋'] },

  // ── Arabic (ar) ──
  { lang: 'ar', category: 'Food', terms: ['مطعم', 'غداء', 'عشاء', 'فطور', 'وجبة', 'شاورما', 'مشاوي'] },
  { lang: 'ar', category: 'Coffee', terms: ['قهوة', 'مقهى', 'كافيه'] },
  { lang: 'ar', category: 'Transport', terms: ['تاكسي', 'مترو', 'حافلة', 'قطار', 'موقف'] },
  { lang: 'ar', category: 'Fuel', terms: ['بنزين', 'وقود', 'محطة وقود'] },
  { lang: 'ar', category: 'Groceries', terms: ['سوبرماركت', 'بقالة', 'خضار', 'فواكه'] },
  { lang: 'ar', category: 'Travel', terms: ['فندق', 'طيران', 'تذكرة طيران', 'سياحة'] },
  { lang: 'ar', category: 'Rent', terms: ['ايجار', 'إيجار', 'شقة'] },
  { lang: 'ar', category: 'Utilities', terms: ['كهرباء', 'فاتورة ماء', 'فاتورة كهرباء', 'انترنت'] },
  { lang: 'ar', category: 'Health', terms: ['صيدلية', 'دواء', 'طبيب', 'مستشفى'] },
];

/**
 * Match multilingual keywords.
 */
export function matchMultilingual(
  rawText: string,
  normalizedText: string
): { category: ExpenseCategory; confidence: number; matchedTerm: string; lang: string } | null {
  for (const entry of MULTILINGUAL_DICTIONARY) {
    for (const term of entry.terms) {
      // For non-Latin scripts (Chinese, Japanese, Arabic), test directly on rawText/normalizedText
      if (['zh', 'ja', 'ar'].includes(entry.lang)) {
        if (rawText.includes(term) || normalizedText.includes(term)) {
          return {
            category: entry.category,
            confidence: 0.9,
            matchedTerm: term,
            lang: entry.lang,
          };
        }
      } else {
        // Latin scripts
        const normTerm = normalizeText(term);
        if (
          normTerm.indexOf(' ') !== -1
            ? containsPhrase(normalizedText, normTerm)
            : containsWord(normalizedText, normTerm)
        ) {
          return {
            category: entry.category,
            confidence: 0.9,
            matchedTerm: term,
            lang: entry.lang,
          };
        }
      }
    }
  }

  return null;
}

