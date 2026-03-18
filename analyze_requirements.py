import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))

from services.scraper.parser import SKILL_WEIGHTS, MAX_POSSIBLE_SCORE

def analyze_requirements():
    corpus = 'ai x web3 global sprint ai web3 python blockchain'
    total = sum(weight for kw, weight in SKILL_WEIGHTS.items() if kw in corpus)
    current_score = min(100, max(5, round(total / MAX_POSSIBLE_SCORE * 100)))

    print(f'Score actual: {current_score}')
    print(f'Para obtener 80 necesitaríamos: {round(80 * MAX_POSSIBLE_SCORE / 100)}')
    print(f'Peso actual obtenido: {total}')
    print(f'Peso máximo posible: {MAX_POSSIBLE_SCORE}')
    print(f'Diferencia: {round(80 * MAX_POSSIBLE_SCORE / 100) - total}')

    # Ver qué palabras clave faltan para llegar a 80
    target_weight = round(80 * MAX_POSSIBLE_SCORE / 100)
    needed_weight = target_weight - total
    print(f'Peso necesario adicional: {needed_weight}')

    # Mostrar palabras clave no encontradas
    print('Palabras clave no encontradas:')
    for kw, weight in SKILL_WEIGHTS.items():
        if kw not in corpus:
            print(f'  {kw}: {weight}')

if __name__ == '__main__':
    analyze_requirements()