# 📘 Guide Complet des Expressions n8n

> Guide ultra-détaillé de toutes les expressions, variables et fonctions n8n disponibles dans le MCP Server

Version : 1.0.0  
Dernière mise à jour : 29 janvier 2025

---

## 🎯 Introduction

Les expressions n8n permettent d'accéder dynamiquement aux données et de les transformer. Elles utilisent la syntaxe `={{...}}`.

**Format de base** :
```javascript
={{expression}}
```

---

## 📦 Variables Globales

### 1. `$json` - Données JSON de l'item courant

```javascript
// Accéder à un champ simple
={{$json.email}}
={{$json.name}}

// Accéder à un champ avec tiret ou espace
={{$json["user-name"]}}
={{$json["First Name"]}}

// Accéder à des propriétés imbriquées
={{$json.user.profile.email}}
={{$json.data.items[0].name}}

// Avec notation bracket
={{$json["user"]["email"]}}
```

**Exemples réels** :
```javascript
// Extraire le domaine d'un email
={{$json.email.split('@')[1]}}

// Combiner des champs
={{$json.firstName + ' ' + $json.lastName}}

// Vérifier l'existence
={{$json.email ? $json.email : 'no-email@example.com'}}
```

---

### 2. `$binary` - Données binaires de l'item courant

```javascript
// Accéder aux données binaires
={{$binary.data}}

// Accéder aux métadonnées
={{$binary.data.fileName}}
={{$binary.data.mimeType}}
={{$binary.data.fileSize}}

// Plusieurs fichiers binaires
={{$binary.attachment1}}
={{$binary.image}}
```

---

### 3. `$node` - Accéder aux données d'autres nœuds

```javascript
// Syntaxe de base
={{$node["Node Name"].json}}

// Exemples
={{$node["HTTP Request"].json.data}}
={{$node["Webhook"].json.body.email}}
={{$node["Function"].json.result}}

// Accéder à plusieurs items d'un nœud
={{$node["Split In Batches"].json}}

// Accéder aux données binaires d'un autre nœud
={{$node["Read File"].binary}}
```

**Exemples réels** :
```javascript
// Combiner données de plusieurs nœuds
={{$node["User Data"].json.name + ' - ' + $node["Order Data"].json.orderId}}

// Accéder à un item spécifique (premier, dernier)
={{$node["HTTP Request"].json[0]}}
={{$node["HTTP Request"].json[$node["HTTP Request"].json.length - 1]}}
```

---

### 4. `$workflow` - Informations sur le workflow

```javascript
// ID du workflow
={{$workflow.id}}

// Nom du workflow
={{$workflow.name}}

// Statut actif
={{$workflow.active}}
```

**Cas d'usage** :
```javascript
// Logger le workflow
="Execution in workflow: {{$workflow.name}} ({{$workflow.id}})"

// Conditionner selon le workflow
={{$workflow.name === 'Production Workflow' ? 'prod@example.com' : 'dev@example.com'}}
```

---

### 5. `$execution` - Informations sur l'exécution

```javascript
// ID de l'exécution
={{$execution.id}}

// Mode d'exécution
={{$execution.mode}}
// Valeurs possibles: 'manual', 'trigger', 'webhook', 'error', 'retry', 'internal'

// URL de reprise (pour Wait node)
={{$execution.resumeUrl}}

// URL du webhook
={{$execution.resumeWebhookUrl}}
```

**Exemples réels** :
```javascript
// ID unique pour tracking
="Request ID: {{$execution.id}}"

// Comportement selon le mode
={{$execution.mode === 'manual' ? 'Test execution' : 'Automated execution'}}
```

---

### 6. `$prevNode` - Nœud précédent

```javascript
// Nom du nœud précédent
={{$prevNode.name}}

// Données du nœud précédent
={{$prevNode.json}}

// Paramètres du nœud précédent
={{$prevNode.parameters}}
```

---

### 7. `$runIndex` - Index d'exécution

```javascript
// Numéro d'exécution (pour les boucles)
={{$runIndex}}

// Exemple : "Iteration 3"
="Iteration {{$runIndex}}"
```

---

### 8. `$mode` - Mode d'exécution

```javascript
// Mode courant
={{$mode}}
// Valeurs: 'manual', 'trigger', 'internal'
```

---

### 9. `$now` - Date et heure actuelle

```javascript
// Date actuelle (DateTime object)
={{$now}}

// Timestamp Unix
={{$now.toUnixInteger()}}

// Formatage personnalisé
={{$now.format('yyyy-MM-dd')}}
={{$now.format('HH:mm:ss')}}
={{$now.format('MMMM dd, yyyy')}}

// Opérations sur les dates
={{$now.plus(1, 'days')}}
={{$now.minus(2, 'hours')}}
={{$now.beginningOf('month')}}
={{$now.endOf('week')}}

// Comparaisons
={{$now.isAfter($json.deadline)}}
={{$now.isBefore($json.startDate)}}
={{$now.isBetween($json.startDate, $json.endDate)}}
```

**Exemples réels** :
```javascript
// Timestamp pour nommage de fichier
="backup-{{$now.format('yyyy-MM-dd-HHmmss')}}.json"

// Calculer l'âge
={{$now.diff($json.birthdate, 'years')}}

// Vérifier si aujourd'hui
={{$now.format('yyyy-MM-dd') === $json.date.format('yyyy-MM-dd')}}
```

---

### 10. `$today` - Date du jour (minuit)

```javascript
// Date d'aujourd'hui à 00:00:00
={{$today}}

// Formater
={{$today.format('yyyy-MM-dd')}}

// Début du mois en cours
={{$today.beginningOf('month')}}
```

---

### 11. `$secrets` - Accès aux credentials (limité)

```javascript
// Dans certains contextes seulement
={{$credentials.apiKey}}
={{$credentials.username}}
```

---

## 🔧 Fonctions JavaScript Intégrées

### Fonctions String

```javascript
// Majuscules / Minuscules
={{$json.name.toUpperCase()}}
={{$json.name.toLowerCase()}}

// Trim (supprimer espaces)
={{$json.email.trim()}}

// Split (diviser)
={{$json.fullName.split(' ')}}
={{$json.email.split('@')[0]}}  // partie avant @
={{$json.email.split('@')[1]}}  // domaine

// Replace (remplacer)
={{$json.text.replace('old', 'new')}}
={{$json.text.replaceAll(' ', '-')}}

// Substring
={{$json.code.substring(0, 5)}}

// Includes (contient)
={{$json.email.includes('@gmail.com')}}

// StartsWith / EndsWith
={{$json.url.startsWith('https')}}
={{$json.file.endsWith('.pdf')}}

// Concat (concaténer)
={{$json.firstName.concat(' ', $json.lastName)}}

// Repeat
={{$json.char.repeat(5)}}

// Pad (ajouter caractères)
={{$json.id.padStart(5, '0')}}  // "00123"
={{$json.code.padEnd(10, 'X')}}  // "CODE123XXX"

// Match (regex)
={{$json.text.match(/\d+/)}}  // premier nombre
={{$json.text.match(/\d+/g)}}  // tous les nombres
```

---

### Fonctions Array

```javascript
// Length
={{$json.items.length}}

// Accéder à un élément
={{$json.items[0]}}
={{$json.items[$json.items.length - 1]}}  // dernier

// Map (transformer)
={{$json.users.map(u => u.email)}}
={{$json.items.map(i => i.name + ' - ' + i.price)}}

// Filter (filtrer)
={{$json.users.filter(u => u.age > 18)}}
={{$json.items.filter(i => i.status === 'active')}}

// Find (trouver)
={{$json.users.find(u => u.id === 123)}}

// Some / Every (vérifier)
={{$json.items.some(i => i.price > 100)}}  // au moins un
={{$json.items.every(i => i.stock > 0)}}   // tous

// Reduce (agréger)
={{$json.items.reduce((sum, i) => sum + i.price, 0)}}

// Join (joindre)
={{$json.tags.join(', ')}}
={{$json.emails.join(';')}}

// Slice (extraire)
={{$json.items.slice(0, 5)}}  // 5 premiers
={{$json.items.slice(-3)}}    // 3 derniers

// Sort (trier)
={{$json.items.sort((a, b) => a.price - b.price)}}
={{$json.names.sort()}}

// Reverse (inverser)
={{$json.items.reverse()}}

// Includes
={{$json.tags.includes('important')}}

// Flat (aplatir)
={{$json.nestedArray.flat()}}
={{$json.deepArray.flat(2)}}  // niveau 2
```

---

### Fonctions Number

```javascript
// Conversion
={{Number($json.stringNumber)}}
={{parseInt($json.value)}}
={{parseFloat($json.decimal)}}

// Arrondi
={{Math.round($json.price)}}
={{Math.floor($json.value)}}
={{Math.ceil($json.value)}}
={{$json.decimal.toFixed(2)}}  // 2 décimales

// Min / Max
={{Math.min($json.a, $json.b, $json.c)}}
={{Math.max(...$json.numbers)}}

// Aléatoire
={{Math.random()}}
={{Math.floor(Math.random() * 100)}}  // 0-99

// Abs (valeur absolue)
={{Math.abs($json.value)}}

// Puissance
={{Math.pow($json.base, $json.exponent)}}
={{$json.value ** 2}}  // carré

// Racine carrée
={{Math.sqrt($json.value)}}
```

---

### Fonctions Date

```javascript
// Créer une date
={{new Date($json.dateString)}}
={{new Date($json.timestamp * 1000)}}

// Formater avec n8n DateTime
={{$now.format('yyyy-MM-dd HH:mm:ss')}}

// Extraire composants
={{$now.year()}}
={{$now.month()}}   // 1-12
={{$now.day()}}     // 1-31
={{$now.hour()}}
={{$now.minute()}}
={{$now.second()}}
={{$now.weekday()}}  // 1-7 (lundi-dimanche)

// Manipuler
={{$now.plus(7, 'days')}}
={{$now.minus(2, 'months')}}
={{$now.set({hour: 9, minute: 0})}}

// Début / Fin de période
={{$now.startOf('day')}}
={{$now.endOf('month')}}

// Différence
={{$now.diff($json.createdAt, 'days')}}
={{$now.diff($json.timestamp, 'hours')}}

// Comparaisons
={{$now.isAfter($json.date)}}
={{$now.isBefore($json.deadline)}}
={{$now.isSame($json.date, 'day')}}
```

---

### Fonctions Object

```javascript
// Keys (clés)
={{Object.keys($json)}}
={{Object.keys($json.user)}}

// Values (valeurs)
={{Object.values($json)}}

// Entries (paires clé-valeur)
={{Object.entries($json)}}

// Assign (fusionner)
={{Object.assign({}, $json, {newField: 'value'})}}

// Has Own Property
={{$json.hasOwnProperty('email')}}
```

---

### Fonctions JSON

```javascript
// Stringify (objet → string)
={{JSON.stringify($json)}}
={{JSON.stringify($json, null, 2)}}  // formaté

// Parse (string → objet)
={{JSON.parse($json.jsonString)}}

// Exemple: envoyer JSON dans un body
={{JSON.stringify({
  name: $json.name,
  email: $json.email,
  timestamp: $now.toISO()
})}}
```

---

## 🎨 Opérateurs

### Opérateurs de comparaison

```javascript
// Égalité
={{$json.status === 'active'}}
={{$json.age !== 0}}

// Comparaisons numériques
={{$json.price > 100}}
={{$json.stock >= 10}}
={{$json.discount < 0.5}}
={{$json.score <= 100}}
```

---

### Opérateurs logiques

```javascript
// AND (et)
={{$json.age > 18 && $json.verified === true}}

// OR (ou)
={{$json.role === 'admin' || $json.role === 'moderator'}}

// NOT (non)
={{!$json.disabled}}
={{$json.email !== null && $json.email !== ''}}
```

---

### Opérateur ternaire

```javascript
// Condition ? valeur_si_vrai : valeur_si_faux
={{$json.status === 'premium' ? 0 : 9.99}}
={{$json.age >= 18 ? 'adult' : 'minor'}}

// Imbriqué
={{$json.score >= 90 ? 'A' : ($json.score >= 80 ? 'B' : 'C')}}
```

---

### Opérateur Nullish Coalescing

```javascript
// Valeur par défaut si null/undefined
={{$json.email ?? 'no-email@example.com'}}
={{$json.name ?? 'Anonymous'}}

// Chaîne optionnelle
={{$json.user?.profile?.email}}
={{$json.data?.items?.[0]?.name}}
```

---

## 🧩 Patterns Courants

### 1. Construire une URL dynamique

```javascript
="https://api.example.com/users/{{$json.userId}}/orders?limit=10"
="https://example.com/profile/{{$json.username}}"
```

---

### 2. Créer un objet JSON complexe

```javascript
={{
  {
    user: {
      id: $json.id,
      name: $json.firstName + ' ' + $json.lastName,
      email: $json.email.toLowerCase()
    },
    metadata: {
      timestamp: $now.toISO(),
      source: 'n8n-workflow',
      executionId: $execution.id
    },
    items: $json.cart.map(item => ({
      productId: item.id,
      quantity: item.qty,
      total: item.price * item.qty
    }))
  }
}}
```

---

### 3. Validation conditionnelle

```javascript
// Vérifier email valide
={{/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($json.email)}}

// Vérifier téléphone (format simple)
={{/^\d{10}$/.test($json.phone)}}

// Vérifier présence de champs requis
={{$json.name && $json.email && $json.phone}}
```

---

### 4. Transformation de données

```javascript
// Extraire domaine email
={{$json.email.split('@')[1]}}

// Initiales
={{$json.firstName[0] + $json.lastName[0]}}

// Slug (URL-friendly)
={{$json.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}}

// Format monétaire
={{$json.price.toFixed(2) + ' EUR'}}
```

---

### 5. Gestion des tableaux

```javascript
// Somme totale
={{$json.items.reduce((sum, i) => sum + i.price, 0)}}

// Moyenne
={{$json.scores.reduce((sum, s) => sum + s, 0) / $json.scores.length}}

// Grouper par catégorie (exemple simplifié)
={{$json.items.filter(i => i.category === 'electronics')}}

// Dédupliquer
={{[...new Set($json.emails)]}}
```

---

### 6. Dates relatives

```javascript
// "Il y a X jours"
={{$now.diff($json.createdAt, 'days') + ' days ago'}}

// "Dans X heures"
={{$json.deadline.diff($now, 'hours') + ' hours remaining'}}

// Date formatée en français
={{$json.date.toLocaleString('fr-FR')}}
```

---

### 7. Fallback en cascade

```javascript
// Utiliser la première valeur disponible
={{$json.preferredEmail ?? $json.workEmail ?? $json.personalEmail ?? 'unknown'}}

// Nom complet avec fallback
={{$json.displayName ?? ($json.firstName + ' ' + $json.lastName) ?? 'User'}}
```

---

### 8. Headers HTTP dynamiques

```javascript
// Authorization header
="Bearer {{$json.accessToken}}"

// Content-Type conditionnel
={{$json.format === 'xml' ? 'application/xml' : 'application/json'}}

// Custom header avec timestamp
="{{$json.apiKey}}-{{$now.toUnixInteger()}}"
```

---

### 9. Query parameters

```javascript
// Construire query string
={{Object.entries($json.filters)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&')}}

// Exemple simple
="page={{$json.page}}&limit={{$json.limit}}&sort={{$json.sortBy}}"
```

---

### 10. Logging et debugging

```javascript
// Message de log détaillé
="[{{$now.toISO()}}] Processing item {{$json.id}} in workflow {{$workflow.name}}"

// Dump complet pour debug
={{JSON.stringify({
  json: $json,
  node: $prevNode.name,
  execution: $execution.id,
  timestamp: $now.toISO()
}, null, 2)}}
```

---

## ⚠️ Pièges Courants

### 1. Accès à des propriétés undefined

```javascript
// ❌ MAUVAIS - peut crasher
={{$json.user.profile.email}}

// ✅ BON - safe avec optional chaining
={{$json.user?.profile?.email}}
={{$json.user?.profile?.email ?? 'no-email'}}
```

---

### 2. Expressions dans les strings

```javascript
// ❌ MAUVAIS - expression non évaluée
"Hello {{$json.name}}"

// ✅ BON - utiliser l'expression complète
="Hello {{$json.name}}"

// ✅ BON - concaténation
={{'Hello ' + $json.name}}
```

---

### 3. Comparaison de types

```javascript
// ❌ MAUVAIS - comparaison string vs number
={{$json.age === '25'}}

// ✅ BON - conversion explicite
={{$json.age === Number($json.ageString)}}
={{String($json.age) === '25'}}
```

---

### 4. Boucles et performance

```javascript
// ❌ MAUVAIS - opérations lourdes dans map
={{$json.items.map(item => {
  // Calculs complexes, appels async, etc.
})}}

// ✅ BON - garder les expressions simples
={{$json.items.map(item => item.id)}}
```

---

## 📚 Exemples Complets par Cas d'Usage

### Cas 1 : Webhook → Traitement → Email

```javascript
// Dans HTTP Request - URL dynamique
="https://api.crm.com/contacts/{{$json.body.userId}}"

// Dans Set node - Construire l'objet
={{
  {
    contactId: $node["HTTP Request"].json.data.id,
    fullName: $json.body.firstName + ' ' + $json.body.lastName,
    email: $json.body.email.toLowerCase(),
    source: 'webhook',
    registeredAt: $now.toISO()
  }
}}

// Dans Email - Sujet dynamique
="Welcome {{$json.fullName}} - Your account is ready"

// Dans Email - Corps avec template
="Hello {{$json.fullName}},

Your account has been created successfully.

Account ID: {{$json.contactId}}
Email: {{$json.email}}
Registered: {{$now.format('MMMM dd, yyyy')}}

Best regards,
The Team"
```

---

### Cas 2 : Traitement de commandes

```javascript
// Dans IF node - Vérifier montant élevé
={{$json.totalAmount > 1000}}

// Dans Function - Calculer totaux
const items = $input.all();
const total = items.reduce((sum, item) => {
  return sum + (item.json.quantity * item.json.price);
}, 0);

return [{
  json: {
    orderId: items[0].json.orderId,
    itemCount: items.length,
    subtotal: total,
    tax: total * 0.2,
    total: total * 1.2
  }
}];

// Dans Switch - Router par catégorie
={{$json.category}}
// Outputs: 0="electronics", 1="clothing", 2="food"
```

---

### Cas 3 : Synchronisation de données

```javascript
// Dans Merge - Enrichir données
// mergeByFields: field1="userId", field2="id"

// Dans Set après merge - Combiner
={{
  {
    userId: $json.userId,
    userName: $json.name,
    orderCount: $json.orders?.length ?? 0,
    lastOrder: $json.orders?.[0]?.date ?? null,
    totalSpent: $json.orders?.reduce((sum, o) => sum + o.amount, 0) ?? 0
  }
}}
```

---

## 🔗 Ressources Officielles

- **Documentation n8n** : https://docs.n8n.io/code-examples/expressions/
- **DateTime Operations** : https://docs.n8n.io/code-examples/expressions/luxon/
- **JMESPath** : https://docs.n8n.io/code-examples/expressions/jmespath/

---

## ✅ Checklist pour Claude

Quand tu utilises une expression n8n :

- [ ] Vérifier que la syntaxe commence par `={{` et finit par `}}`
- [ ] Utiliser `?.` pour les propriétés potentiellement undefined
- [ ] Valider les types avant comparaison
- [ ] Préférer les expressions simples et lisibles
- [ ] Tester les cas null/undefined avec `??`
- [ ] Formater les dates avec `.format()` ou `.toISO()`
- [ ] Encoder les URLs avec `encodeURIComponent()`
- [ ] Logger les erreurs potentielles avec JSON.stringify()

---

*Document créé le 29 janvier 2025 pour le MCP Server n8n*
