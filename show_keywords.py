import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from services.scraper.parser import SKILL_WEIGHTS

def show_keywords():
    print('Todas las palabras clave y sus pesos:')
    for k, v in sorted(SKILL_WEIGHTS.items(), key=lambda x: x[1], reverse=True):
        print(f'  {k}: {v}')

if __name__ == '__main__':
    show_keywords()