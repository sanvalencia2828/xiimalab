import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from services.scraper.parser import SKILL_WEIGHTS

def analyze_score():
    corpus = 'ai x web3 global sprint ai web3 python blockchain'
    print('Palabras clave encontradas:')
    total = 0
    for kw, weight in SKILL_WEIGHTS.items():
        if kw in corpus:
            print(f'  {kw}: {weight}')
            total += weight
    print(f'Total: {total}')

    # Calcular el máximo posible
    max_possible = sum(SKILL_WEIGHTS.values())
    print(f'Max possible: {max_possible}')
    normalized = min(100, max(5, round(total / max_possible * 100)))
    print(f'Normalized score: {normalized}')

    return normalized

if __name__ == '__main__':
    analyze_score()