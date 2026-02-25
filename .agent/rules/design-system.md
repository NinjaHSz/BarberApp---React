---
trigger: always_on
---

# DESIGN SYSTEM — BARBERAPP

Este documento define a linguagem visual e os padrões técnicos para o BarberApp. Todo o desenvolvimento deve seguir rigorosamente os tokens semânticos definidos abaixo para garantir consistência e uma experiência premium.

---

## 1. VISÃO GERAL

O BarberApp é uma plataforma de gestão de alto nível para barbearias. A estética é **Monochromatic Dark Pure**, utilizando uma escala de cinzas profundos. O design é focado em **Elevação por Tons** e **Sombras Profundas**, recusando o uso de qualquer linha de contraste (borders).

---

## 2. REGRAS TÉCNICAS (CRÍTICAS)

- **Zero Borders**: É terminantemente proibido o uso de `border`, `border-t`, `border-b`, etc. A separação é feita por cores de fundo e sombras.
- **Fixed Palette**: Não existe personalização de cores. A cor de destaque é fixada em **Cinza Claro / Gelo (#FAFAFA)**.
- **Elevação**: Containers devem usar `glass-card` com blur de 16px.

---

## 3. PALETA DE CORES (TOKENS)

### Texto

| Token              | Valor Real | Descrição                    |
| :----------------- | :--------- | :--------------------------- |
| **text-primary**   | `#FFFFFF`  | Títulos e textos principais. |
| **text-secondary** | `#A1A1AA`  | Subtítulos e labels.         |
| **text-muted**     | `#52525B`  | Placeholders e hints.        |

### Superfícies

| Token               | Valor Real              | Descrição                   |
| :------------------ | :---------------------- | :-------------------------- |
| **surface-page**    | `#09090B`               | Fundo principal.            |
| **surface-section** | `#18181B`               | Seções e sidebars.          |
| **surface-card**    | `rgba(24, 24, 27, 0.8)` | Cards (Glassmorphism 16px). |
| **surface-subtle**  | `#27272A`               | Hover states e realces.     |

### Destaque (Fixed Gray)

| Token             | Valor Real | Descrição                                       |
| :---------------- | :--------- | :---------------------------------------------- |
| **brand-primary** | `#D4D4D8`  | Cor de destaque fixa (Botões principais, KPIs). |

---

## 4. BORDAS E STATUS (RESET GLOBAL)

- **Bordas**: Desativadas globalmente via `index.html`.
- **Status**: Indicado por tonalidades de cinza ou brilho sutil.
