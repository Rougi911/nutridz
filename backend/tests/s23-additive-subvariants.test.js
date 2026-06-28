'use strict';
/**
 * DEF-7 — Sous-variantes d'additifs : héritage du code parent.
 *
 * Avant : E322i, E450ii, E500ii, E160ai… (non listés individuellement) étaient classés
 * « unknown » alors qu'ils partagent le profil EFSA de leur code parent (E322, E450, E500,
 * E160a). `classifyAdditive` remonte au parent en retirant les lettres de sous-variante
 * une à une. Les sous-divisions explicitement classées (E150a..d) gardent leur valeur propre.
 *
 * Test sur les VRAIS modules (pas de mock) → valide contre la table de classification réelle.
 */

const { classifyAdditive } = require('../services/additiveClassify');
const { resolveAdditiveName } = require('../services/additiveResolver');

describe('DEF-7 — classifyAdditive : repli sur le code parent', () => {
  test('E322i hérite de E322 (Lécithines, low)', () => {
    expect(classifyAdditive('E322i')?.risk).toBe('low');
  });

  test('E450i et E450ii héritent de E450 (Diphosphates, moderate)', () => {
    expect(classifyAdditive('E450i')?.risk).toBe('moderate');
    expect(classifyAdditive('E450ii')?.risk).toBe('moderate');
  });

  test('E500ii hérite de E500 (Carbonates de sodium, low)', () => {
    expect(classifyAdditive('E500ii')?.risk).toBe('low');
  });

  test('E160ai (deux niveaux) s\'arrête à E160a (low), pas E160', () => {
    expect(classifyAdditive('E160ai')?.risk).toBe('low');
    expect(classifyAdditive('E160a')?.risk).toBe('low'); // parent direct présent
  });

  test('non-régression : E150d garde sa valeur propre (high), pas E150', () => {
    expect(classifyAdditive('E150d')?.risk).toBe('high');
  });

  test('non-régression : code exact classé reste inchangé (E322 = low)', () => {
    expect(classifyAdditive('E322')?.risk).toBe('low');
  });

  test('code réellement inconnu → null (pas de parent classé)', () => {
    expect(classifyAdditive('E999')).toBeNull();   // E999 non classé
    expect(classifyAdditive('E4999')).toBeNull();  // 4 chiffres, non classé
    expect(classifyAdditive('')).toBeNull();
    expect(classifyAdditive(null)).toBeNull();
  });

  test('tolère la casse du préfixe (e322i)', () => {
    expect(classifyAdditive('e322i')?.risk).toBe('low');
  });
});

describe('DEF-7 — resolveAdditiveName : nom du parent pour les sous-variantes', () => {
  test('E322i → nom du parent « Lécithines » (jamais le code brut)', () => {
    const name = resolveAdditiveName('E322i');
    expect(name).not.toBe('E322i');
    expect(name.length).toBeGreaterThan(2);
  });
});
