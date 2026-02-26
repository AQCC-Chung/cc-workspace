"""
Smart Query Parser for TasteMap TW
Handles unsegmented user input, city detection, food/category extraction,
and bilingual query generation.

Examples:
  "東京好吃的拉麵" → city="東京", topic="拉麵", intent="推薦"
  "我想去巴黎吃甜點" → city="巴黎", topic="甜點", intent="推薦"
  "New York pizza" → city="紐約", topic="pizza", intent="推薦"
  "紐約必去景點" → city="紐約", topic="景點", intent="必去"
"""

import re

# ── City aliases: maps various names → canonical Chinese name ──
CITY_ALIASES = {
    # 台灣
    '台北': '台北', 'taipei': '台北',
    '台中': '台中', 'taichung': '台中',
    '高雄': '高雄', 'kaohsiung': '高雄',
    '台南': '台南', 'tainan': '台南',
    '花蓮': '花蓮', 'hualien': '花蓮',
    '宜蘭': '宜蘭', 'yilan': '宜蘭',
    # 日本
    '東京': '東京', 'tokyo': '東京',
    '大阪': '大阪', 'osaka': '大阪',
    '京都': '京都', 'kyoto': '京都',
    '北海道': '北海道', 'hokkaido': '北海道',
    '沖繩': '沖繩', 'okinawa': '沖繩',
    '福岡': '福岡', 'fukuoka': '福岡',
    '名古屋': '名古屋', 'nagoya': '名古屋',
    # 韓國
    '首爾': '首爾', 'seoul': '首爾', '漢城': '首爾',
    '釜山': '釜山', 'busan': '釜山',
    # 東南亞
    '曼谷': '曼谷', 'bangkok': '曼谷',
    '新加坡': '新加坡', 'singapore': '新加坡',
    '吉隆坡': '吉隆坡', 'kuala lumpur': '吉隆坡',
    '峇里島': '峇里島', 'bali': '峇里島', '巴里島': '峇里島',
    '河內': '河內', 'hanoi': '河內',
    '胡志明': '胡志明', 'ho chi minh': '胡志明',
    '清邁': '清邁', 'chiang mai': '清邁',
    '馬尼拉': '馬尼拉', 'manila': '馬尼拉',
    # 港澳中國
    '香港': '香港', 'hong kong': '香港',
    '澳門': '澳門', 'macau': '澳門', 'macao': '澳門',
    '上海': '上海', 'shanghai': '上海',
    '北京': '北京', 'beijing': '北京',
    '廣州': '廣州', 'guangzhou': '廣州',
    '深圳': '深圳', 'shenzhen': '深圳',
    '成都': '成都', 'chengdu': '成都',
    # 歐洲
    '巴黎': '巴黎', 'paris': '巴黎',
    '倫敦': '倫敦', 'london': '倫敦',
    '羅馬': '羅馬', 'rome': '羅馬', 'roma': '羅馬',
    '巴塞隆納': '巴塞隆納', 'barcelona': '巴塞隆納',
    '米蘭': '米蘭', 'milan': '米蘭', 'milano': '米蘭',
    '阿姆斯特丹': '阿姆斯特丹', 'amsterdam': '阿姆斯特丹',
    '柏林': '柏林', 'berlin': '柏林',
    '維也納': '維也納', 'vienna': '維也納',
    '布拉格': '布拉格', 'prague': '布拉格',
    '伊斯坦堡': '伊斯坦堡', 'istanbul': '伊斯坦堡',
    '蘇黎世': '蘇黎世', 'zurich': '蘇黎世',
    # 美洲
    '紐約': '紐約', 'new york': '紐約', 'nyc': '紐約',
    '洛杉磯': '洛杉磯', 'los angeles': '洛杉磯', 'la': '洛杉磯',
    '舊金山': '舊金山', 'san francisco': '舊金山', 'sf': '舊金山',
    '芝加哥': '芝加哥', 'chicago': '芝加哥',
    '拉斯維加斯': '拉斯維加斯', 'las vegas': '拉斯維加斯',
    '溫哥華': '溫哥華', 'vancouver': '溫哥華',
    '多倫多': '多倫多', 'toronto': '多倫多',
    # 大洋洲
    '雪梨': '雪梨', 'sydney': '雪梨',
    '墨爾本': '墨爾本', 'melbourne': '墨爾本',
    '奧克蘭': '奧克蘭', 'auckland': '奧克蘭',
    # 中東
    '杜拜': '杜拜', 'dubai': '杜拜',
}

# Sort by length (longest first) for greedy matching
_SORTED_ALIASES = sorted(CITY_ALIASES.keys(), key=len, reverse=True)


# ── Food / topic keywords ──
FOOD_KEYWORDS = {
    # 中文 → English
    '拉麵': 'ramen', '壽司': 'sushi', '甜點': 'dessert',
    '咖啡': 'coffee', '咖啡廳': 'cafe', '火鍋': 'hotpot',
    '燒肉': 'yakiniku BBQ', '牛排': 'steak', '披薩': 'pizza',
    '素食': 'vegetarian', '海鮮': 'seafood', '早午餐': 'brunch',
    '酒吧': 'bar', '夜市': 'night market', '小吃': 'street food',
    '餐廳': 'restaurant', '料理': 'cuisine', '麵包': 'bakery',
    '蛋糕': 'cake', '冰淇淋': 'ice cream', '居酒屋': 'izakaya',
    '義大利麵': 'pasta', '漢堡': 'burger', '炸雞': 'fried chicken',
    '鍋物': 'hotpot', '燒烤': 'grill BBQ', '串燒': 'yakitori',
    '下午茶': 'afternoon tea', '飲料': 'drinks', '奶茶': 'milk tea',
    '巧克力': 'chocolate', '麻辣': 'spicy', '丼飯': 'donburi',
    '便當': 'bento', '滷味': 'braised snacks', '豆花': 'tofu pudding',
    '粵菜': 'cantonese', '川菜': 'sichuan', '日式': 'japanese',
    '韓式': 'korean', '泰式': 'thai', '越南': 'vietnamese',
    '法式': 'french', '義式': 'italian', '美式': 'american',
    '印度': 'indian', '墨西哥': 'mexican', '中式': 'chinese',
    # English keywords (map to themselves)
    'ramen': 'ramen', 'sushi': 'sushi', 'pizza': 'pizza',
    'steak': 'steak', 'burger': 'burger', 'pasta': 'pasta',
    'brunch': 'brunch', 'cafe': 'cafe', 'coffee': 'coffee',
    'dessert': 'dessert', 'seafood': 'seafood', 'bbq': 'BBQ',
    'dim sum': 'dim sum', 'curry': 'curry', 'noodle': 'noodle',
    'bakery': 'bakery', 'bar': 'bar', 'buffet': 'buffet',
    'vegan': 'vegan', 'vegetarian': 'vegetarian',
}

# Sort food keys by length for greedy matching
_SORTED_FOOD = sorted(FOOD_KEYWORDS.keys(), key=len, reverse=True)

# ── Category / activity keywords ──
CATEGORY_KEYWORDS = {
    '景點': 'attractions sightseeing', '觀光': 'tourism sightseeing',
    '購物': 'shopping', '逛街': 'shopping', '住宿': 'accommodation hotel',
    '飯店': 'hotel', '旅館': 'hotel', '民宿': 'B&B guesthouse',
    'spa': 'spa', '按摩': 'massage spa', '溫泉': 'hot spring onsen',
}

_SORTED_CATEGORY = sorted(CATEGORY_KEYWORDS.keys(), key=len, reverse=True)

# ── Intent words (stripped from query, used for enhancement) ──
INTENT_WORDS = {
    '推薦': 'best recommended', '必吃': 'must-try must-eat',
    '必去': 'must-visit', '好吃': 'delicious best',
    '好玩': 'fun things to do', '熱門': 'popular trending',
    '人氣': 'popular', '排名': 'top ranked', '排行': 'top ranked',
    '評價': 'best rated', '精選': 'curated best', '網紅': 'influencer trending',
    '攻略': 'guide', '最好': 'best', '便宜': 'cheap affordable',
    '高級': 'upscale fine dining', '平價': 'affordable budget',
}

# ── Stop words to remove ──
STOP_WORDS = [
    '我想', '我要', '想去', '想吃', '想找', '有什麼', '有沒有',
    '哪裡有', '去哪', '去哪裡', '推薦一下', '幫我找', '幫我',
    '請問', '什麼', '哪些', '的', '在', '吃', '去', '找',
    '很', '超', '最', '比較', '一些', '一下', '一點',
    '到', '可以', '應該', '能不能', '有', '是', '了', '嗎',
    '好', '必',
    'i want', 'i want to', 'where to', 'where can i',
    'best place', 'looking for', 'find me', 'show me',
    'please', 'recommend', 'suggestion',
]

# Sort stop words by length (longest first) for greedy removal
_SORTED_STOPS = sorted(STOP_WORDS, key=len, reverse=True)


class ParsedQuery:
    """Structured result of query parsing."""

    def __init__(self):
        self.city = ''           # Canonical Chinese city name
        self.city_en = ''        # English city name
        self.topics = []         # List of topic keywords found (Chinese)
        self.topics_en = []      # Corresponding English translations
        self.categories = []     # Category keywords (景點, 購物, etc.)
        self.categories_en = []  # English category translations
        self.intents = []        # Intent words found
        self.intents_en = []     # English intent translations
        self.remainder = ''      # Remaining text after extraction
        self.original = ''       # Original input

    def to_chinese_query(self):
        """Build an enhanced Chinese search query."""
        parts = []
        if self.city:
            parts.append(self.city)
        parts.extend(self.topics)
        parts.extend(self.categories)
        if not self.intents:
            parts.append('推薦')
        else:
            parts.extend(self.intents)
        # Add remainder if it has meaningful content
        if self.remainder and len(self.remainder) > 1:
            parts.append(self.remainder)
        return ' '.join(parts)

    def to_english_query(self):
        """Build an English search query for broader results."""
        parts = []
        if self.city_en:
            parts.append(self.city_en)
        elif self.city:
            # Lookup English name from CITY_ALIASES reverse
            parts.append(self.city)
        parts.extend(self.topics_en)
        parts.extend(self.categories_en)
        if self.intents_en:
            parts.extend(self.intents_en)
        else:
            parts.append('best recommended')
        # Add remainder if it has meaningful content
        if self.remainder and len(self.remainder) > 1 and self.remainder.isascii():
            parts.append(self.remainder)
        return ' '.join(parts)

    def __repr__(self):
        return (f"ParsedQuery(city='{self.city}', topics={self.topics}, "
                f"categories={self.categories}, intents={self.intents}, "
                f"remainder='{self.remainder}')")


# ── Reverse lookup: Chinese city → English name ──
_CITY_EN_MAP = {}
for alias, canonical in CITY_ALIASES.items():
    if alias.isascii() and len(alias) > 2:  # Use longer English names
        if canonical not in _CITY_EN_MAP or len(alias) > len(_CITY_EN_MAP[canonical]):
            _CITY_EN_MAP[canonical] = alias.title()
# Manual overrides for clean English names
_CITY_EN_MAP.update({
    '台北': 'Taipei', '台中': 'Taichung', '高雄': 'Kaohsiung',
    '台南': 'Tainan', '花蓮': 'Hualien', '宜蘭': 'Yilan',
    '東京': 'Tokyo', '大阪': 'Osaka', '京都': 'Kyoto',
    '北海道': 'Hokkaido', '沖繩': 'Okinawa', '福岡': 'Fukuoka',
    '名古屋': 'Nagoya', '首爾': 'Seoul', '釜山': 'Busan',
    '曼谷': 'Bangkok', '新加坡': 'Singapore', '吉隆坡': 'Kuala Lumpur',
    '峇里島': 'Bali', '河內': 'Hanoi', '胡志明': 'Ho Chi Minh',
    '清邁': 'Chiang Mai', '馬尼拉': 'Manila',
    '香港': 'Hong Kong', '澳門': 'Macau',
    '上海': 'Shanghai', '北京': 'Beijing', '廣州': 'Guangzhou',
    '深圳': 'Shenzhen', '成都': 'Chengdu',
    '巴黎': 'Paris', '倫敦': 'London', '羅馬': 'Rome',
    '巴塞隆納': 'Barcelona', '米蘭': 'Milan',
    '阿姆斯特丹': 'Amsterdam', '柏林': 'Berlin',
    '維也納': 'Vienna', '布拉格': 'Prague', '伊斯坦堡': 'Istanbul',
    '蘇黎世': 'Zurich',
    '紐約': 'New York', '洛杉磯': 'Los Angeles',
    '舊金山': 'San Francisco', '芝加哥': 'Chicago',
    '拉斯維加斯': 'Las Vegas', '溫哥華': 'Vancouver', '多倫多': 'Toronto',
    '雪梨': 'Sydney', '墨爾本': 'Melbourne', '奧克蘭': 'Auckland',
    '杜拜': 'Dubai',
})


def parse_query(raw_input: str) -> ParsedQuery:
    """
    Parse a raw user input string into a structured query.

    Handles:
    - Unsegmented Chinese text ("東京好吃的拉麵")
    - Mixed Chinese/English ("巴黎 dessert")
    - Pure English ("New York pizza")
    - Stop word removal ("我想去東京吃壽司" → city=東京, topic=壽司)
    """
    result = ParsedQuery()
    result.original = raw_input.strip()
    text = result.original.lower()

    # 1. Remove stop words first
    for stop in _SORTED_STOPS:
        text = text.replace(stop, ' ')
    text = re.sub(r'\s+', ' ', text).strip()

    # 2. Extract city (longest match first)
    for alias in _SORTED_ALIASES:
        if alias in text:
            result.city = CITY_ALIASES[alias]
            result.city_en = _CITY_EN_MAP.get(result.city, result.city)
            # Remove the matched city from text
            text = text.replace(alias, ' ', 1)
            break

    text = re.sub(r'\s+', ' ', text).strip()

    # 3. Extract intent words
    for intent_zh, intent_en in INTENT_WORDS.items():
        if intent_zh in text:
            result.intents.append(intent_zh)
            result.intents_en.append(intent_en)
            text = text.replace(intent_zh, ' ', 1)

    text = re.sub(r'\s+', ' ', text).strip()

    # 4. Extract food/topic keywords
    for food in _SORTED_FOOD:
        if food in text:
            result.topics.append(food)
            result.topics_en.append(FOOD_KEYWORDS[food])
            text = text.replace(food, ' ', 1)

    text = re.sub(r'\s+', ' ', text).strip()

    # 5. Extract category keywords
    for cat in _SORTED_CATEGORY:
        if cat in text:
            result.categories.append(cat)
            result.categories_en.append(CATEGORY_KEYWORDS[cat])
            text = text.replace(cat, ' ', 1)

    # 6. Whatever is left is the remainder
    result.remainder = re.sub(r'\s+', ' ', text).strip()

    # 7. Default city if none detected
    if not result.city:
        result.city = '台北'
        result.city_en = 'Taipei'

    return result


# Quick test
if __name__ == '__main__':
    test_queries = [
        "東京好吃的拉麵",
        "我想去巴黎吃甜點",
        "紐約必去景點",
        "New York pizza",
        "台北咖啡廳推薦",
        "首爾燒肉",
        "曼谷好玩的景點",
        "沖繩海鮮餐廳",
        "london brunch",
        "我想找大阪好吃的壽司",
        "巴塞隆納逛街購物",
        "dubai buffet",
    ]

    for q in test_queries:
        parsed = parse_query(q)
        print(f"\n輸入: {q}")
        print(f"  解析: {parsed}")
        print(f"  中文: {parsed.to_chinese_query()}")
        print(f"  英文: {parsed.to_english_query()}")
