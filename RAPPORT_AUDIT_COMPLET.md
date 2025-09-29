# RAPPORT D'AUDIT COMPLET - n8n-MCP-Server

**Date:** 29 janvier 2025
**Version analysée:** 2.0.0
**Analyste:** Audit Technique Complet
**Fichiers principaux analysés:**
- `index.js` (294 lignes) - Version basique
- `index-complete.js` (922 lignes) - Version avec manipulation avancée
- `index-minimal.js` (8197 lignes) - Version enterprise complète
- `advanced-node-manipulation-tools.cjs` (887 lignes)
- `package.json`, `README.md`, bases de données JSON

---

## RÉSUMÉ EXÉCUTIF

### Points Forts ✅
- **Système de fallback universel opérationnel** : Support de 100% des nœuds n8n (400+)
- **3 versions du serveur** : basique (5 outils), complète (18 outils), enterprise (47+ outils)
- **Documentation extensive** : 26 nœuds documentés, 100+ exemples d'expressions, 30+ code snippets
- **Conformité MCP SDK v1.18.2** : Handlers correctement implémentés

### Problèmes Critiques Identifiés ❌
1. **Aucun support des endpoints critiques n8n** : credentials, tags, users, variables, audit logs, webhooks
2. **Manque de support MCP Resources et Prompts** : Seulement Tools implémentés
3. **3 fichiers index différents** : Confusion sur lequel utiliser (package.json pointe vers index.js basique)
4. **Fichiers markdown fantômes** : 5 fichiers listés dans git status mais inexistants
5. **Pas de gestion des credentials n8n** : Seulement configuration de node credentials
6. **Aucun endpoint d'administration** : tags, audit, users, variables manquants
7. **index-minimal.js non documenté** : 8197 lignes, 47 outils, mais pas dans README

---

## 1. PROBLÈMES CRITIQUES IDENTIFIÉS

### 1.1 Configuration et Déploiement ⚠️

| Problème | Gravité | Impact | Fichier:Ligne |
|----------|---------|--------|---------------|
| **package.json pointe vers index.js (basique)** au lieu de index-complete.js | CRITIQUE | Utilisateur n'a accès qu'à 5 outils au lieu de 18+ | package.json:6 |
| **README mentionne index-minimal.js** qui n'est pas configuré comme point d'entrée | MAJEUR | Confusion sur quelle version utiliser | README.md:121 |
| **3 fichiers index différents sans documentation claire** | MAJEUR | Utilisateur ne sait pas quelle version choisir | / |
| **Fichiers markdown fantômes dans git status** | MINEUR | ANALYSE_MODIFICATION_NOEUDS.md, BILAN_CAPACITES_ACTUELLES.md, etc. listés mais inexistants | git status |

**Recommandation URGENTE** :
```json
// package.json devrait pointer vers :
"main": "index-complete.js"  // OU index-minimal.js selon besoin
```

### 1.2 Endpoints n8n API Manquants ⚠️⚠️⚠️

Le projet utilise **UNIQUEMENT** ces endpoints :
- ✅ `GET /api/v1/workflows` (list)
- ✅ `GET /api/v1/workflows/:id` (get)
- ✅ `POST /api/v1/workflows` (create)
- ✅ `PATCH /api/v1/workflows/:id` (update)
- ✅ `DELETE /api/v1/workflows/:id` (delete)
- ✅ `POST /api/v1/workflows/:id/execute` (execute)
- ✅ `GET /api/v1/node-types` (list node types)

**Endpoints critiques ABSENTS** :

| Endpoint Manquant | Utilité | Priorité | Présent dans projet référence |
|-------------------|---------|----------|------------------------------|
| `GET /api/v1/credentials` | Lister les credentials | HAUTE | czlonkowski ❓ |
| `POST /api/v1/credentials` | Créer des credentials | HAUTE | czlonkowski ❓ |
| `GET /api/v1/credentials/:id` | Obtenir un credential | HAUTE | czlonkowski ❓ |
| `PATCH /api/v1/credentials/:id` | Modifier un credential | HAUTE | czlonkowski ❓ |
| `DELETE /api/v1/credentials/:id` | Supprimer un credential | HAUTE | czlonkowski ❓ |
| `POST /api/v1/credentials/:id/test` | Tester un credential | HAUTE | czlonkowski ❓ |
| `GET /api/v1/executions` | Lister les exécutions | HAUTE | ✅ leonardsellem |
| `GET /api/v1/executions/:id` | Obtenir une exécution | HAUTE | ✅ leonardsellem |
| `POST /api/v1/executions/:id/stop` | Arrêter une exécution | HAUTE | ✅ leonardsellem |
| `DELETE /api/v1/executions/:id` | Supprimer une exécution | MOYENNE | leonardsellem ❓ |
| `GET /api/v1/tags` | Lister les tags | MOYENNE | Non trouvé |
| `POST /api/v1/tags` | Créer un tag | MOYENNE | Non trouvé |
| `PATCH /api/v1/tags/:id` | Modifier un tag | BASSE | Non trouvé |
| `DELETE /api/v1/tags/:id` | Supprimer un tag | BASSE | Non trouvé |
| `GET /api/v1/users` | Lister les utilisateurs | MOYENNE | Non trouvé |
| `POST /api/v1/users` | Créer un utilisateur | MOYENNE | Non trouvé |
| `GET /api/v1/users/:id` | Obtenir un utilisateur | BASSE | Non trouvé |
| `PATCH /api/v1/users/:id` | Modifier un utilisateur | BASSE | Non trouvé |
| `DELETE /api/v1/users/:id` | Supprimer un utilisateur | BASSE | Non trouvé |
| `GET /api/v1/variables` | Lister les variables d'environnement | MOYENNE | Non trouvé |
| `POST /api/v1/variables` | Créer une variable | MOYENNE | Non trouvé |
| `PATCH /api/v1/variables/:id` | Modifier une variable | BASSE | Non trouvé |
| `DELETE /api/v1/variables/:id` | Supprimer une variable | BASSE | Non trouvé |
| `POST /api/v1/workflows/:id/activate` | Activer un workflow | HAUTE | ✅ index-minimal.js:5137 |
| `POST /api/v1/workflows/:id/deactivate` | Désactiver un workflow | HAUTE | ✅ index-minimal.js |
| `GET /api/v1/audit` | Logs d'audit | MOYENNE | Non trouvé |
| `POST /webhook/:path` | Trigger webhook | HAUTE | ✅ leonardsellem |
| `GET /api/v1/community-packages` | Lister community nodes | BASSE | Non trouvé |
| `POST /api/v1/community-packages` | Installer community node | BASSE | Non trouvé |

**Note importante** :
- `index-minimal.js` a des tools `execution_list`, `execution_get`, `execution_stop` mais utilise des endpoints `/workflows/:id/execute` au lieu de `/executions`
- Le projet leonardsellem a un support webhook complet qui manque ici

### 1.3 Conformité MCP SDK v1.18.2 ⚠️

| Aspect | Status | Détails | Fichier:Ligne |
|--------|--------|---------|---------------|
| **ListToolsRequestSchema** | ✅ CONFORME | Bien implémenté dans les 3 versions | index.js:29, index-complete.js:40, index-minimal.js:3325 |
| **CallToolRequestSchema** | ✅ CONFORME | Handlers corrects avec try-catch | index.js:107, index-complete.js:410, index-minimal.js:4757 |
| **Structure des réponses** | ✅ CONFORME | content array + isError correctement utilisés | Tous fichiers |
| **ListResourcesRequestSchema** | ❌ ABSENT | Resources MCP non implémentés (sauf index-minimal.js) | - |
| **ReadResourceRequestSchema** | ❌ ABSENT | Resources MCP non implémentés (sauf index-minimal.js) | - |
| **ListPromptsRequestSchema** | ❌ ABSENT | Prompts MCP non implémentés | - |
| **GetPromptRequestSchema** | ❌ ABSENT | Prompts MCP non implémentés | - |

**MCP SDK Best Practices (Spec 2025-06-18)** :

Selon la spécification MCP 2025, **3 primitives** doivent être implémentées :

1. **Resources** ❌ MANQUANT (sauf index-minimal.js ligne 4600+)
   - Resources = Data sources (comme GET endpoints REST)
   - Exemple : `n8n://workflows/list`, `n8n://executions/{workflowId}`
   - **Implémenté uniquement dans index-minimal.js**
   - ❌ Absent de index.js et index-complete.js

2. **Prompts** ❌ TOTALEMENT ABSENT
   - Prompts = Messages structurés et instructions pour LLM
   - Exemple : Template prompts pour créer workflows courants
   - Permettrait à Claude de découvrir des "recettes" prêtes à l'emploi

3. **Tools** ✅ BIEN IMPLÉMENTÉ
   - 5 tools (index.js)
   - 18 tools (index-complete.js)
   - 47 tools (index-minimal.js)

**Exemple de ce qui devrait exister** :

```javascript
// Resources manquantes dans index.js et index-complete.js
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "n8n://workflows/list",
        name: "All Workflows",
        description: "List of all n8n workflows",
        mimeType: "application/json"
      },
      {
        uri: "n8n://executions/{workflowId}",
        name: "Workflow Executions",
        description: "Execution history for a workflow",
        mimeType: "application/json"
      },
      {
        uri: "n8n://nodes/documentation",
        name: "Node Documentation",
        description: "Complete node parameters database",
        mimeType: "application/json"
      }
    ]
  };
});

// Prompts manquants dans TOUS les fichiers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "create_webhook_to_email",
        description: "Create a simple webhook to email workflow",
        arguments: [
          { name: "email", description: "Email address to send to", required: true }
        ]
      },
      {
        name: "create_api_polling_workflow",
        description: "Create a workflow that polls an API regularly",
        arguments: [
          { name: "api_url", description: "API endpoint to poll", required: true },
          { name: "interval", description: "Poll interval in minutes", required: false }
        ]
      }
    ]
  };
});
```

### 1.4 Sécurité MCP (Spec June 2025) ⚠️

La spec MCP de juin 2025 introduit des clarifications importantes sur l'autorisation :

| Aspect Sécurité | Status | Détails |
|-----------------|--------|---------|
| **Resource Indicators (RFC 8707)** | ⚠️ PARTIELLEMENT | Implémenté dans index-minimal.js mais pas documenté |
| **Authorization flows** | ❌ ABSENT | Pas de consent/authorization flow dans index.js/index-complete.js |
| **Access controls** | ⚠️ PARTIELLEMENT | RBAC dans index-minimal.js uniquement |
| **Malicious server prevention** | ❌ ABSENT | Pas de validation des tokens dans index.js/index-complete.js |

**index-minimal.js a des features enterprise** :
- ✅ JWT authentication (ligne 20-25)
- ✅ RBAC avec permissions (ligne 45-80)
- ✅ Resource Indicators (ligne 27-33)
- ✅ Audit logging (ligne 24)
- ✅ Multi-tenant support (ligne 25)

**Mais index.js et index-complete.js n'ont AUCUNE sécurité !**

---

## 2. OUTILS MCP MANQUANTS PAR RAPPORT AUX PROJETS DE RÉFÉRENCE

### 2.1 Comparaison avec czlonkowski/n8n-mcp (536 nodes, 99% coverage)

**Outils présents dans czlonkowski ABSENTS ici** :

| Outil czlonkowski | Description | Utilité | Priorité |
|-------------------|-------------|---------|----------|
| `search_templates_by_metadata()` | Chercher templates par métadonnées | Découverte intelligente de templates | HAUTE |
| `search_nodes()` | Chercher nœuds par fonctionnalité | Meilleure UX pour trouver le bon nœud | HAUTE |
| `list_ai_tools()` | Lister 263 nœuds AI-capable | Workflows AI | MOYENNE |
| `validate_node_minimal()` | Validation minimale de nœud | Feedback rapide | MOYENNE |
| `validate_node_operation()` | Valider une opération de nœud | Éviter erreurs d'exécution | HAUTE |
| `validate_workflow_connections()` | Valider les connexions | Détecter connexions invalides | HAUTE |
| `validate_workflow_expressions()` | Valider les expressions n8n | Détecter erreurs de syntaxe | HAUTE |
| `n8n_update_partial_workflow()` | Mise à jour partielle optimisée | Performance | MOYENNE |

**Points forts de czlonkowski** :
- 99% node property coverage vs ~6.5% ici (26 nœuds sur 400)
- 63.6% node operation coverage (absent ici)
- Validation à plusieurs niveaux (absente ici sauf validateWorkflowNode)
- Template-first approach avec marketplace

**Notre avantage sur czlonkowski** :
- ✅ Fallback universel 100% via API n8n (eux ont doc statique)
- ✅ Code snippets intégrés (30+)
- ✅ Guide expressions n8n complet (100+ exemples)
- ✅ Manipulation granulaire des paramètres (configure_node_parameters)

### 2.2 Comparaison avec leonardsellem/n8n-mcp-server

**Outils présents dans leonardsellem ABSENTS ici** :

| Outil leonardsellem | Description | Implémenté ici ? | Fichier |
|---------------------|-------------|------------------|---------|
| `workflow_activate` | Activer workflow | ⚠️ PARTIEL | index-minimal.js seulement |
| `workflow_deactivate` | Désactiver workflow | ⚠️ PARTIEL | index-minimal.js seulement |
| `execution_run` | Exécuter workflow via API | ✅ OUI | execute_workflow |
| `run_webhook` | Exécuter via webhook | ❌ NON | MANQUANT |
| `execution_get` | Détails d'exécution | ⚠️ PARTIEL | index-minimal.js seulement |
| `execution_list` | Lister exécutions workflow | ⚠️ PARTIEL | index-minimal.js seulement |
| `execution_stop` | Arrêter exécution en cours | ⚠️ PARTIEL | index-minimal.js seulement |

**Resources leonardsellem** (nous n'avons pas) :
- `n8n://workflows/list`
- `n8n://executions/{workflowId}`

**CRITICAL MISSING** : **Webhook support**

leonardsellem a un support webhook complet avec :
- Authentification basic auth pour webhooks
- Variables d'env `N8N_WEBHOOK_USERNAME` et `N8N_WEBHOOK_PASSWORD`
- Outil `run_webhook` dédié

**Nous n'avons RIEN de cela !**

### 2.3 Outils uniques à notre projet (Avantages compétitifs)

| Outil | Description | Fichier | Unique ? |
|-------|-------------|---------|----------|
| `describe_node_type` | Documentation complète d'un nœud avec fallback API | index-complete.js:651 | ✅ UNIQUE |
| `discover_node` | Force découverte dynamique depuis API | index-complete.js:664 | ✅ UNIQUE |
| `configure_node_parameters` | Modification granulaire de paramètres | index-complete.js:696 | ✅ UNIQUE |
| `add_node_expression` | Ajout expressions n8n validées | index-complete.js:716 | ✅ UNIQUE |
| `configure_node_code` | Configuration code Function/Code nodes | index-complete.js:737 | ✅ UNIQUE |
| `configure_node_credentials` | Configuration credentials de nœud | index-complete.js:758 | ✅ UNIQUE |
| `get_code_snippet` | Snippets de code réutilisables | index-complete.js:778 | ✅ UNIQUE |
| `validate_workflow_node` | Validation d'un nœud | index-complete.js:790 | Partiel |
| `modify_single_node` | Modification chirurgicale d'un nœud | index-complete.js:802 | ✅ UNIQUE |
| `add_nodes_to_workflow` | Ajout de nœuds avec auto-connect | index-complete.js:832 | ✅ UNIQUE |
| `remove_nodes_from_workflow` | Suppression avec cleanup connexions | index-complete.js:869 | ✅ UNIQUE |

**index-minimal.js outils enterprise uniques** :
- `analyze_workflow_structure` - Analyse complète (structure, perf, sécurité)
- `visualize_workflow_diagram` - Diagrammes ASCII/Mermaid
- `get_workflow_statistics` - Métriques détaillées
- `suggest_workflow_improvements` - Recommandations AI
- `create_workflow_template` - Création templates
- `apply_workflow_template` - Instanciation templates
- `workflow_diff` - Comparaison workflows
- `rollback_workflow` - Retour en arrière
- `browse_template_marketplace` - Marketplace templates
- `manage_workflow_versions` - Versioning
- `manage_environments` - Multi-environnements (dev/staging/prod)
- `validate_workflow_best_practices` - Best practices
- `ai_debug_workflow` - Debug assisté par AI

**Total : 47 outils dans index-minimal.js !**

---

## 3. ANALYSE DE L'ARCHITECTURE

### 3.1 Structure des fichiers

```
n8n-claude-MCP-server/
├── index.js                              (294 lignes)  - 5 outils basiques
├── index-complete.js                     (922 lignes)  - 18 outils avancés
├── index-minimal.js                      (8197 lignes) - 47 outils enterprise
├── advanced-node-manipulation-tools.cjs  (887 lignes)  - 7 fonctions + fallback
├── package.json                          - Pointe vers index.js ⚠️
├── README.md                             - Mentionne index-minimal.js ⚠️
├── node-parameters-database.json         - 5 nœuds documentés
├── node-parameters-extended.json         - 21 nœuds documentés (total 26)
├── N8N_EXPRESSIONS_GUIDE.md             - 100+ exemples expressions
├── node-code-snippets.json               - 30+ code templates
├── FALLBACK_UNIVERSEL.md                 - Doc système fallback
└── RAPPORT_AUDIT_COMPLET.md              - Ce document
```

**INCOHÉRENCES CRITIQUES** :

1. **package.json:6** dit `"main": "index.js"`
2. **README.md:121** dit d'utiliser `index-minimal.js`
3. **git status** liste 5 fichiers .md qui n'existent PAS

**Impact** : Utilisateur installe et a seulement 5 outils au lieu de 18 ou 47 !

### 3.2 Mapping des outils par version

| Outil | index.js | index-complete.js | index-minimal.js |
|-------|----------|-------------------|------------------|
| `list_workflows` | ✅ | ✅ | ✅ |
| `get_workflow` | ✅ | ✅ | ✅ |
| `create_workflow` | ✅ | ✅ | ✅ (version avancée) |
| `update_workflow` | ❌ | ✅ | ✅ |
| `delete_workflow` | ❌ | ✅ | ✅ |
| `execute_workflow` | ✅ | ✅ | ✅ |
| `list_node_types` | ✅ | ✅ | ✅ |
| `describe_node_type` | ❌ | ✅ | ❌ |
| `discover_node` | ❌ | ✅ | ❌ |
| `configure_node_parameters` | ❌ | ✅ | ❌ |
| `add_node_expression` | ❌ | ✅ | ❌ |
| `configure_node_code` | ❌ | ✅ | ❌ |
| `configure_node_credentials` | ❌ | ✅ | ❌ |
| `get_code_snippet` | ❌ | ✅ | ❌ |
| `validate_workflow_node` | ❌ | ✅ | ❌ |
| `modify_single_node` | ❌ | ✅ | ✅ |
| `add_nodes_to_workflow` | ❌ | ✅ | ✅ |
| `remove_nodes_from_workflow` | ❌ | ✅ | ✅ |
| `activate_workflow` | ❌ | ❌ | ✅ |
| `create_advanced_workflow` | ❌ | ❌ | ✅ |
| `execution_list` | ❌ | ❌ | ✅ |
| `execution_get` | ❌ | ❌ | ✅ |
| `execution_stop` | ❌ | ❌ | ✅ |
| `analyze_workflow_structure` | ❌ | ❌ | ✅ |
| `visualize_workflow_diagram` | ❌ | ❌ | ✅ |
| `get_workflow_statistics` | ❌ | ❌ | ✅ |
| `suggest_workflow_improvements` | ❌ | ❌ | ✅ |
| `create_workflow_template` | ❌ | ❌ | ✅ |
| `apply_workflow_template` | ❌ | ❌ | ✅ |
| `workflow_diff` | ❌ | ❌ | ✅ |
| `rollback_workflow` | ❌ | ❌ | ✅ |
| ... (29 autres outils enterprise) | ❌ | ❌ | ✅ |

**TOTAL** : 5 | 18 | 47

### 3.3 Cohérence des endpoints API

**index.js** : Utilise `/workflows` sans `/api/v1/`
```javascript
// index.js:148
url: `${N8N_API_URL}/api/v1${endpoint}`,
// Appels : '/workflows', '/workflows/:id', etc.
```

**index-complete.js** : Utilise `/api/v1/workflows` DIRECTEMENT
```javascript
// index-complete.js:479
url: `${N8N_API_URL}${endpoint}`,
// Appels : '/api/v1/workflows', '/api/v1/workflows/:id', etc.
```

**index-minimal.js** : Utilise `/workflows` sans préfixe (différent !)
```javascript
// index-minimal.js:3306
url: `${N8N_API_URL}/rest${endpoint}`,
// Appels : '/workflows', '/executions', etc.
```

**INCOHÉRENCE** : 3 façons différentes d'appeler l'API !

- index.js ajoute `/api/v1` avant l'endpoint
- index-complete.js attend endpoint complet avec `/api/v1/`
- index-minimal.js utilise `/rest` au lieu de `/api/v1` ⚠️

**Cela signifie** :
- Si n8n change l'API path, il faut modifier 3 fichiers différemment
- Pas de fonction utilitaire partagée
- Risque de bugs lors de maintenance

### 3.4 Gestion d'erreurs

| Aspect | index.js | index-complete.js | index-minimal.js |
|--------|----------|-------------------|------------------|
| Try-catch global | ✅ Ligne 130-141 | ✅ Ligne 460-470 | ✅ Ligne 4760+ |
| Gestion 401 | ✅ Ligne 176-186 | ✅ Ligne 507-518 | ❌ Pas de gestion spécifique |
| Stack trace en erreur | ❌ | ✅ Ligne 465 | ❌ |
| Retry logic | ❌ | ❌ | ⚠️ Partiel (ligne 800+) |
| Timeout handling | ❌ | ❌ | ❌ |
| Rate limiting | ❌ | ❌ | ⚠️ Stores (ligne 90) |

**Problèmes identifiés** :
1. Aucun retry automatique en cas d'échec réseau
2. Pas de timeout sur les requêtes axios
3. Pas de circuit breaker pattern
4. Rate limiting défini mais pas implémenté dans index-minimal.js

---

## 4. PROBLÈMES DE VALIDATION ET SÉCURITÉ

### 4.1 Validation des entrées

| Outil | Validation inputSchema | Validation runtime | Sanitization |
|-------|------------------------|-------------------|--------------|
| `create_workflow` (index.js) | ✅ JSON Schema | ❌ Aucune | ❌ Aucune |
| `create_workflow` (index-complete.js) | ✅ JSON Schema | ❌ Aucune | ❌ Aucune |
| `create_workflow` (index-minimal.js) | ✅ JSON Schema détaillé | ⚠️ Partielle (ligne 800+) | ⚠️ Partielle |
| `configure_node_parameters` | ✅ JSON Schema | ✅ Ligne 263+ (advanced-tools) | ⚠️ Partielle |
| `add_node_expression` | ✅ JSON Schema | ✅ Ligne 407+ (validation syntax) | ❌ Aucune |
| `configure_node_code` | ✅ JSON Schema | ✅ Ligne 534+ (validation JS) | ❌ Aucune |

**Problèmes** :
1. **Pas de validation des données avant envoi à n8n API** (sauf dans advanced-tools)
2. **Pas de sanitization des inputs** - Risque XSS si nœud affiche du HTML
3. **Pas de validation des credentials** - Accepte n'importe quoi
4. **Pas de validation des connexions** - Peut créer des boucles infinies

### 4.2 Sécurité des credentials

**PROBLÈME MAJEUR** : Le projet gère la **configuration** de credentials dans les nœuds, mais pas la **gestion** des credentials dans n8n !

```javascript
// Ce qui existe (index-complete.js:758)
async configureNodeCredentials(workflowId, nodeId, credentialType, credentialId) {
  // Configure un nœud pour UTILISER un credential existant
  node.credentials[credentialType] = { id: credentialId, name: credentialType };
}
```

**Ce qui MANQUE** :
```javascript
// ABSENT : Créer un credential dans n8n
async createCredential(name, type, data) {
  return await this.makeApiRequest('/api/v1/credentials', 'POST', {
    name: name,
    type: type,
    data: data  // ⚠️ Sensible !
  });
}

// ABSENT : Lister les credentials disponibles
async listCredentials() {
  return await this.makeApiRequest('/api/v1/credentials', 'GET');
}

// ABSENT : Tester un credential
async testCredential(credentialId) {
  return await this.makeApiRequest(`/api/v1/credentials/${credentialId}/test`, 'POST');
}
```

**Impact** : Claude ne peut pas créer de credentials, donc workflows avec auth échouent !

### 4.3 Injection et XSS

**Vulnérabilités potentielles** :

1. **SQL Injection** : N/A (pas de DB directe)

2. **Command Injection** : ⚠️ POSSIBLE
```javascript
// advanced-node-manipulation-tools.cjs:636
new Function(code);  // ⚠️ Exécute code arbitraire !
```

3. **Expression Injection** : ⚠️ POSSIBLE
```javascript
// Les expressions n8n peuvent accéder à des variables sensibles
={{$env.N8N_API_KEY}}  // ⚠️ Peut leak API key !
```

4. **XSS** : ⚠️ POSSIBLE
```javascript
// Si un nœud Set affiche du HTML non sanitized
parameters: {
  value: '<script>alert("XSS")</script>'  // ⚠️ Non sanitized
}
```

**Recommandations** :
1. Sanitize tous les inputs avant `new Function()`
2. Valider les expressions n8n (pas d'accès à $env)
3. Escape HTML dans les paramètres de type string
4. Ajouter une whitelist de fonctions JS autorisées

---

## 5. DOCUMENTATION ET BASE DE CONNAISSANCES

### 5.1 Couverture de la documentation

| Ressource | Nœuds documentés | Qualité | Fichier |
|-----------|------------------|---------|---------|
| `node-parameters-database.json` | 5 nœuds | Excellent (détaillé) | 1-100 lignes par nœud |
| `node-parameters-extended.json` | 21 nœuds | Bon (structure de base) | 50 lignes par nœud |
| Fallback API n8n | 400+ nœuds | Moyen (auto-généré) | Runtime |
| **TOTAL COVERAGE** | **26 détaillés + 400+ basiques** | **100%** | - |

**Nœuds documentés localement** (26) :
1. `n8n-nodes-base.httpRequest` ✅
2. `n8n-nodes-base.if` ✅
3. `n8n-nodes-base.switch` ✅
4. `n8n-nodes-base.merge` ✅
5. `n8n-nodes-base.set` ✅
6. `n8n-nodes-base.function` ✅
7. `n8n-nodes-base.code` ✅
8. `n8n-nodes-base.webhook` ✅
9. `n8n-nodes-base.wait` ✅
10. `n8n-nodes-base.splitInBatches` ✅
11. `n8n-nodes-base.itemLists` ✅
12. `n8n-nodes-base.filter` ✅
13. `n8n-nodes-base.aggregate` ✅
14. `n8n-nodes-base.sort` ✅
15. `n8n-nodes-base.limit` ✅
16. `n8n-nodes-base.removeDuplicates` ✅
17. `n8n-nodes-base.scheduleTimer` ✅
18. `n8n-nodes-base.cron` ✅
19. `n8n-nodes-base.executeWorkflow` ✅
20. `n8n-nodes-base.respondToWebhook` ✅
21. `n8n-nodes-base.stickyNote` ✅
22. `n8n-nodes-base.noOp` ✅
23. `n8n-nodes-base.emailSend` ✅
24. `n8n-nodes-base.readBinaryFile` ✅
25. `n8n-nodes-base.writeBinaryFile` ✅
26. `n8n-nodes-base.moveBinaryData` ✅

**Nœuds populaires NON documentés localement** :
- ❌ `n8n-nodes-base.slack` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.gmail` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.openai` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.discord` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.telegram` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.googleSheets` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.notion` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.postgres` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.mysql` - Mais couvert par fallback ✅
- ❌ `n8n-nodes-base.redis` - Mais couvert par fallback ✅

**Comparaison avec czlonkowski** :
- czlonkowski : 536 nœuds documentés statiquement (99% properties, 63.6% operations)
- Notre projet : 26 détaillés + 400+ découverte dynamique (100% coverage mais moins de détails)

**Avantage czlonkowski** : Documentation plus riche (operations, exemples)
**Notre avantage** : Support automatique des nouveaux nœuds

### 5.2 Guide des expressions n8n

**N8N_EXPRESSIONS_GUIDE.md** - Analyse :

| Section | Lignes | Exemples | Qualité |
|---------|--------|----------|---------|
| Introduction | 1-20 | 5 | Bon |
| Variables globales | 21-150+ | 30+ | Excellent |
| `$json` | 23-52 | 10+ | Excellent |
| `$binary` | 54-71 | 6 | Bon |
| `$node` | 73-100 | 8 | Excellent |
| `$workflow` | 104-124 | 5 | Bon |
| `$execution` | 128-150+ | 7 | Bon |
| ... (autres sections) | ... | ... | ... |

**Points forts** :
- ✅ 100+ exemples concrets
- ✅ Cas d'usage réels
- ✅ Patterns courants
- ✅ Best practices

**Manques** :
- ❌ Pas de section sur les fonctions Luxon ($now, $today)
- ❌ Pas de section sur les helpers ($input, $item)
- ❌ Pas d'exemples avec methods JavaScript avancées

### 5.3 Code snippets

**node-code-snippets.json** - Analyse :

| Catégorie | Snippets | Qualité | Utilité |
|-----------|----------|---------|---------|
| `dataTransformation` | 4 snippets | Excellent | Très haute |
| `filtering` | 3 snippets | Bon | Haute |
| `aggregation` | 3 snippets | Excellent | Haute |
| `stringManipulation` | ? snippets | ? | Moyenne |
| ... | ... | ... | ... |

**Snippets disponibles** :
1. `extractFields` - Extraire champs spécifiques
2. `renameFields` - Renommer des champs
3. `flattenNested` - Aplatir structure imbriquée
4. `addComputedFields` - Ajouter champs calculés
5. `filterByCondition` - Filtrer par condition
6. `filterByDate` - Filtrer par date
7. `removeDuplicates` - Supprimer doublons
8. `sum` - Calculer somme
9. `groupBy` - Grouper par catégorie
10. `statistics` - Calculer statistiques
11. ... (20+ autres)

**Points forts** :
- ✅ Code prêt à l'emploi
- ✅ Commentaires explicatifs
- ✅ Catégorisation claire

**Manques** :
- ❌ Pas de snippets pour interactions API
- ❌ Pas de snippets pour gestion d'erreurs
- ❌ Pas de snippets pour async/await patterns
- ❌ Pas de snippets pour workflows AI (embeddings, etc.)

---

## 6. SYSTÈME DE FALLBACK UNIVERSEL

### 6.1 Fonctionnement

**Architecture** (FALLBACK_UNIVERSEL.md) :

```
1. Chercher dans base locale (26 nœuds)
   └─> Si trouvé : Retour documentation détaillée

2. Si non trouvé : Interroger API n8n (/api/v1/node-types)
   └─> Parser définition
   └─> Mettre en cache
   └─> Retourner documentation basique

3. Si API échoue : Retourner erreur avec suggestions
```

**Implémentation** (advanced-node-manipulation-tools.cjs) :

| Fonction | Lignes | Rôle |
|----------|--------|------|
| `getNodeDefinitionFromN8n()` | 41-100 | Récupère définition depuis API |
| `parseNodeProperties()` | 105-140 | Parse propriétés du nœud |
| `describeNodeType()` | 147-217 | Stratégie fallback 3 niveaux |
| `generateQuickStartGuide()` | 222-259 | Génère guide démarrage |

**Cache** :
```javascript
// Ligne 35
const nodeDefinitionCache = new Map();
```
- ✅ Cache en mémoire
- ⚠️ Perdu au redémarrage du serveur
- ❌ Pas de cache persistant sur disque

**Tests** (FALLBACK_UNIVERSEL.md:200-244) :
- ✅ 5 tests automatisés
- ✅ Teste nœud local, fallback, cache
- ✅ Teste nœuds populaires (Slack, Gmail, etc.)

### 6.2 Performance

**Mesures estimées** :
- Local DB lookup : ~0.1ms (Map.get)
- API n8n request : ~50-200ms (HTTP)
- Cache hit : ~0.1ms

**Optimisation** :
- ✅ Cache réduit requêtes API de ~95%
- ❌ Mais cache non persistant (perdu au restart)

**Recommandation** :
```javascript
// Persister le cache sur disque
const fs = require('fs');
const CACHE_FILE = './node-definition-cache.json';

// Au démarrage
if (fs.existsSync(CACHE_FILE)) {
  const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  Object.entries(cacheData).forEach(([key, value]) => {
    nodeDefinitionCache.set(key, value);
  });
}

// Périodiquement (toutes les 5 min)
setInterval(() => {
  const cacheObject = Object.fromEntries(nodeDefinitionCache);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObject, null, 2));
}, 300000);
```

### 6.3 Couverture réelle

**Test empirique** (FALLBACK_UNIVERSEL.md:220) :
- ✅ Slack : Découvert avec succès
- ✅ Gmail : Découvert avec succès
- ✅ OpenAI : Découvert avec succès
- ✅ Discord : Présumé OK (pas testé)
- ✅ Telegram : Présumé OK (pas testé)

**Limites** :
- ⚠️ Dépend de l'instance n8n utilisateur (community nodes)
- ⚠️ Si n8n API change, fallback peut casser
- ⚠️ Pas de gestion de versions de nœuds (typeVersion)

---

## 7. COMPARAISON AVEC BONNES PRATIQUES MCP

### 7.1 MCP Specification 2025-06-18

| Aspect | Notre implémentation | Best Practice | Gap |
|--------|---------------------|---------------|-----|
| **Tools** | ✅ 5/18/47 tools | ✅ Implémenté | Bon |
| **Resources** | ❌ Absent (sauf index-minimal) | ⚠️ Recommandé | MANQUE |
| **Prompts** | ❌ Totalement absent | ⚠️ Recommandé | MANQUE |
| **Transport** | ✅ StdioServerTransport | ✅ Standard | Bon |
| **Sécurité** | ⚠️ Partielle (index-minimal) | ✅ Obligatoire | AMÉLIORER |
| **Error handling** | ✅ Try-catch + isError | ✅ Standard | Bon |
| **Schema validation** | ✅ inputSchema JSON | ✅ Standard | Bon |

**Resources Best Practice** :
```javascript
// Ce que nous devrions avoir
{
  uri: "n8n://workflows/list",
  name: "All Workflows",
  mimeType: "application/json"
}
```

**Prompts Best Practice** :
```javascript
// Ce que nous devrions avoir
{
  name: "create_webhook_workflow",
  description: "Create a webhook-triggered workflow",
  arguments: [
    { name: "webhook_path", required: true },
    { name: "action_description", required: true }
  ]
}
```

### 7.2 Sécurité MCP (Spec June 2025)

**Resource Indicators (RFC 8707)** :

| Requirement | index.js | index-complete.js | index-minimal.js |
|-------------|----------|-------------------|------------------|
| Resource Indicator generation | ❌ | ❌ | ✅ Ligne 292+ |
| Indicator validation | ❌ | ❌ | ✅ Ligne 315+ |
| Token scoping | ❌ | ❌ | ✅ Ligne 161+ |
| Malicious server prevention | ❌ | ❌ | ⚠️ Partiel |

**Authorization flows** :

index-minimal.js a un système complet :
- ✅ JWT tokens (ligne 20-25)
- ✅ User authentication (ligne 4161+)
- ✅ RBAC permissions (ligne 45-80)
- ✅ Audit logging (ligne 84, 4233+)

index.js et index-complete.js : **RIEN** ⚠️

**Recommandation** :
- Soit adopter index-minimal.js comme version principale
- Soit backporter la sécurité dans index-complete.js

### 7.3 Error Handling Best Practices

**Spec MCP** : Retourner `{ content: [...], isError: true }`

Notre implémentation :
```javascript
// index-complete.js:460-470
return {
  content: [
    {
      type: 'text',
      text: `Error: ${error.message}\n\nStack: ${error.stack}`
    }
  ],
  isError: true
};
```

✅ **CONFORME**

**Améliorations possibles** :
1. Catégoriser les erreurs (ValidationError, APIError, AuthError)
2. Ajouter error codes
3. Ajouter hints pour résolution
4. Logger les erreurs pour debugging

Exemple amélioré :
```javascript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: error.message,
          hint: 'Use list_workflows to see available workflows',
          category: 'API_ERROR'
        }
      }, null, 2)
    }
  ],
  isError: true
};
```

---

## 8. ACTIONS PRIORITAIRES (TOP 10)

### Priorité CRITIQUE 🔴

1. **Fixer package.json pour pointer vers index-complete.js ou index-minimal.js**
   - **Ligne** : package.json:6
   - **Action** : Changer `"main": "index.js"` en `"main": "index-complete.js"`
   - **Impact** : Utilisateur aura accès à tous les outils
   - **Effort** : 1 minute

2. **Ajouter endpoints Credentials management**
   - **Endpoints** : GET/POST/PATCH/DELETE /api/v1/credentials
   - **Fichier** : index-complete.js ou index-minimal.js
   - **Impact** : Claude pourra créer des credentials pour workflows
   - **Effort** : 2-3 heures
   - **Code exemple** :
```javascript
case 'list_credentials':
  return await this.listCredentials();
case 'create_credential':
  return await this.createCredential(args);
case 'test_credential':
  return await this.testCredential(args.credentialId);
```

3. **Ajouter support Webhooks (comme leonardsellem)**
   - **Endpoint** : POST /webhook/:path
   - **Variables** : N8N_WEBHOOK_USERNAME, N8N_WEBHOOK_PASSWORD
   - **Fichier** : index-complete.js
   - **Impact** : Trigger workflows via webhook
   - **Effort** : 3-4 heures

### Priorité HAUTE 🟠

4. **Implémenter MCP Resources dans index-complete.js**
   - **Schemas** : ListResourcesRequestSchema, ReadResourceRequestSchema
   - **Resources** : `n8n://workflows/list`, `n8n://executions/{id}`
   - **Fichier** : index-complete.js (s'inspirer de index-minimal.js:4600+)
   - **Impact** : Conformité MCP Spec 2025
   - **Effort** : 4-5 heures

5. **Implémenter MCP Prompts**
   - **Schemas** : ListPromptsRequestSchema, GetPromptRequestSchema
   - **Prompts** : Templates de workflows courants
   - **Fichier** : index-complete.js
   - **Impact** : UX améliorée pour utilisateurs
   - **Effort** : 5-6 heures
   - **Code exemple** :
```javascript
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "webhook_to_email",
        description: "Create webhook to email workflow",
        arguments: [
          { name: "email", description: "Email address", required: true }
        ]
      }
    ]
  };
});
```

6. **Ajouter endpoints Executions management**
   - **Endpoints** : GET /api/v1/executions, GET /api/v1/executions/:id, POST /api/v1/executions/:id/stop
   - **Fichier** : index-complete.js (copier depuis index-minimal.js)
   - **Impact** : Monitoring et debug des workflows
   - **Effort** : 2-3 heures

7. **Unifier la méthode makeApiRequest**
   - **Problème** : 3 implémentations différentes (avec `/api/v1`, `/rest`, etc.)
   - **Action** : Créer fichier `n8n-api-client.js` partagé
   - **Fichiers** : Tous les index.*
   - **Impact** : Maintenance plus facile
   - **Effort** : 3-4 heures

### Priorité MOYENNE 🟡

8. **Améliorer validation et sécurité**
   - **Actions** :
     - Sanitize inputs avant `new Function()`
     - Valider expressions n8n (bloquer $env)
     - Ajouter timeout sur requêtes axios
     - Implémenter retry logic
   - **Fichiers** : advanced-node-manipulation-tools.cjs, index-complete.js
   - **Impact** : Sécurité renforcée
   - **Effort** : 6-8 heures

9. **Persister le cache du fallback sur disque**
   - **Action** : Sauvegarder nodeDefinitionCache dans JSON file
   - **Fichier** : advanced-node-manipulation-tools.cjs
   - **Impact** : Performance (pas de requêtes API au restart)
   - **Effort** : 1-2 heures

10. **Créer documentation pour choisir la version**
    - **Action** : Document "QUELLE_VERSION_CHOISIR.md"
    - **Contenu** :
      - index.js : 5 outils, pour démo simple
      - index-complete.js : 18 outils, manipulation avancée de nœuds
      - index-minimal.js : 47 outils, enterprise avec sécurité
    - **Impact** : Clarté pour utilisateurs
    - **Effort** : 1 heure

---

## 9. CODE À AJOUTER/MODIFIER (Exemples Spécifiques)

### 9.1 Fixer package.json

**Fichier** : `package.json`
**Ligne** : 6

**Avant** :
```json
"main": "index.js",
```

**Après** :
```json
"main": "index-complete.js",
```

**OU** (pour version enterprise) :
```json
"main": "index-minimal.js",
```

---

### 9.2 Ajouter Credentials Management

**Fichier** : `index-complete.js`
**Après ligne** : 157 (dans tools array)

**Ajouter** :
```javascript
{
  name: 'list_credentials',
  description: 'List all available credentials in n8n',
  inputSchema: {
    type: 'object',
    properties: {},
  },
},
{
  name: 'create_credential',
  description: 'Create a new credential in n8n',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the credential',
      },
      type: {
        type: 'string',
        description: 'Credential type (e.g., "httpBasicAuth", "slackApi")',
      },
      data: {
        type: 'object',
        description: 'Credential data (keys depend on type)',
      },
    },
    required: ['name', 'type', 'data'],
  },
},
{
  name: 'test_credential',
  description: 'Test if a credential is valid',
  inputSchema: {
    type: 'object',
    properties: {
      credentialId: {
        type: 'string',
        description: 'ID of the credential to test',
      },
    },
    required: ['credentialId'],
  },
},
{
  name: 'delete_credential',
  description: 'Delete a credential',
  inputSchema: {
    type: 'object',
    properties: {
      credentialId: {
        type: 'string',
        description: 'ID of the credential to delete',
      },
    },
    required: ['credentialId'],
  },
},
```

**Ajouter dans switch (ligne 414)** :
```javascript
case 'list_credentials':
  return await this.listCredentials();
case 'create_credential':
  return await this.createCredential(args);
case 'test_credential':
  return await this.testCredential(args.credentialId);
case 'delete_credential':
  return await this.deleteCredential(args.credentialId);
```

**Ajouter méthodes (après ligne 647)** :
```javascript
async listCredentials() {
  try {
    const credentials = await this.makeApiRequest('/api/v1/credentials');
    return {
      content: [
        {
          type: 'text',
          text: `Found ${credentials.data.length} credentials:\n\n` +
                credentials.data.map(c => `- ${c.name} (Type: ${c.type}, ID: ${c.id})`).join('\n'),
        },
      ],
    };
  } catch (error) {
    if (error.response?.status === 401) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Invalid API key. Please check your n8n API key configuration.',
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
}

async createCredential({ name, type, data }) {
  try {
    const credential = await this.makeApiRequest('/api/v1/credentials', 'POST', {
      name: name,
      type: type,
      data: data
    });
    return {
      content: [
        {
          type: 'text',
          text: `Credential created successfully!\nID: ${credential.id}\nName: ${credential.name}\nType: ${credential.type}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error creating credential: ${error.message}\n\nHint: Check that the credential type '${type}' is valid and data is correct.`,
        },
      ],
      isError: true,
    };
  }
}

async testCredential(credentialId) {
  try {
    const result = await this.makeApiRequest(`/api/v1/credentials/${credentialId}/test`, 'POST');
    return {
      content: [
        {
          type: 'text',
          text: result.success
            ? `Credential test successful! The credential is valid.`
            : `Credential test failed: ${result.message || 'Unknown error'}`,
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error testing credential: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async deleteCredential(credentialId) {
  try {
    await this.makeApiRequest(`/api/v1/credentials/${credentialId}`, 'DELETE');
    return {
      content: [
        {
          type: 'text',
          text: `Credential ${credentialId} deleted successfully!`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error deleting credential: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
```

---

### 9.3 Ajouter Support Webhooks

**Fichier** : `index-complete.js`
**Après ligne** : 12

**Ajouter configuration** :
```javascript
const N8N_WEBHOOK_USERNAME = process.env.N8N_WEBHOOK_USERNAME || '';
const N8N_WEBHOOK_PASSWORD = process.env.N8N_WEBHOOK_PASSWORD || '';
```

**Dans tools array (après ligne 157)** :
```javascript
{
  name: 'execute_workflow_webhook',
  description: 'Execute a workflow via its webhook endpoint (requires webhook node)',
  inputSchema: {
    type: 'object',
    properties: {
      workflowName: {
        type: 'string',
        description: 'Name of the workflow with webhook trigger',
      },
      webhookPath: {
        type: 'string',
        description: 'Webhook path (from webhook node configuration)',
      },
      data: {
        type: 'object',
        description: 'Data to send to the webhook',
        default: {},
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method for webhook',
        default: 'POST',
      },
    },
    required: ['workflowName', 'webhookPath'],
  },
},
```

**Dans switch (ligne 427)** :
```javascript
case 'execute_workflow_webhook':
  return await this.executeWorkflowWebhook(args);
```

**Ajouter méthode (après ligne 597)** :
```javascript
async executeWorkflowWebhook({ workflowName, webhookPath, data = {}, method = 'POST' }) {
  try {
    // Construire l'URL du webhook
    const webhookUrl = `${N8N_API_URL}/webhook/${webhookPath}`;

    // Configuration de la requête avec authentification si fournie
    const config = {
      method: method,
      url: webhookUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Ajouter authentification basique si credentials fournis
    if (N8N_WEBHOOK_USERNAME && N8N_WEBHOOK_PASSWORD) {
      config.auth = {
        username: N8N_WEBHOOK_USERNAME,
        password: N8N_WEBHOOK_PASSWORD,
      };
    }

    // Ajouter données pour POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      config.data = data;
    }

    const response = await axios(config);

    return {
      content: [
        {
          type: 'text',
          text: `Webhook triggered successfully!\nWorkflow: ${workflowName}\nResponse: ${JSON.stringify(response.data, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error triggering webhook: ${error.message}\n\nHint: Make sure the workflow has a webhook node with path '${webhookPath}' and is active.`,
        },
      ],
      isError: true,
    };
  }
}
```

**Mettre à jour README** :
```markdown
### Environment Variables for Webhooks

```bash
N8N_WEBHOOK_USERNAME=your_webhook_username
N8N_WEBHOOK_PASSWORD=your_webhook_password
```
```

---

### 9.4 Ajouter MCP Resources

**Fichier** : `index-complete.js`
**Ligne** : 3 (imports)

**Ajouter** :
```javascript
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
```

**Ligne** : 18-21 (capabilities)

**Modifier** :
```javascript
capabilities: {
  tools: {},
  resources: {},  // <-- AJOUTER
},
```

**Après ligne** : 36 (après setupHandlers() {)

**Ajouter** :
```javascript
// Handler pour lister les resources
this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'n8n://workflows/list',
        name: 'All Workflows',
        description: 'Complete list of all n8n workflows',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://workflows/{workflowId}',
        name: 'Workflow Details',
        description: 'Detailed information about a specific workflow',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://node-types/list',
        name: 'Available Node Types',
        description: 'List of all available n8n node types',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://node-types/{nodeType}',
        name: 'Node Type Documentation',
        description: 'Complete documentation for a specific node type',
        mimeType: 'application/json',
      },
      {
        uri: 'n8n://expressions/guide',
        name: 'n8n Expressions Guide',
        description: 'Complete guide of n8n expressions with examples',
        mimeType: 'text/markdown',
      },
      {
        uri: 'n8n://code-snippets/{category}',
        name: 'Code Snippets',
        description: 'Reusable code snippets for Function and Code nodes',
        mimeType: 'application/json',
      },
    ],
  };
});

// Handler pour lire une resource
this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    // Workflows list
    if (uri === 'n8n://workflows/list') {
      const workflows = await this.makeApiRequest('/api/v1/workflows');
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(workflows, null, 2),
          },
        ],
      };
    }

    // Specific workflow
    const workflowMatch = uri.match(/^n8n:\/\/workflows\/(.+)$/);
    if (workflowMatch) {
      const workflowId = workflowMatch[1];
      const workflow = await this.makeApiRequest(`/api/v1/workflows/${workflowId}`);
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(workflow, null, 2),
          },
        ],
      };
    }

    // Node types list
    if (uri === 'n8n://node-types/list') {
      const nodeTypes = await this.makeApiRequest('/api/v1/node-types');
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(nodeTypes, null, 2),
          },
        ],
      };
    }

    // Specific node type
    const nodeTypeMatch = uri.match(/^n8n:\/\/node-types\/(.+)$/);
    if (nodeTypeMatch) {
      const nodeType = nodeTypeMatch[1];
      const nodeDoc = await advancedTools.describeNodeType(nodeType, N8N_API_URL, N8N_API_KEY);
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(nodeDoc, null, 2),
          },
        ],
      };
    }

    // Expressions guide
    if (uri === 'n8n://expressions/guide') {
      const fs = require('fs');
      const guidePath = './N8N_EXPRESSIONS_GUIDE.md';
      if (fs.existsSync(guidePath)) {
        const guide = fs.readFileSync(guidePath, 'utf8');
        return {
          contents: [
            {
              uri: uri,
              mimeType: 'text/markdown',
              text: guide,
            },
          ],
        };
      }
    }

    // Code snippets
    const snippetMatch = uri.match(/^n8n:\/\/code-snippets\/(.+)$/);
    if (snippetMatch) {
      const category = snippetMatch[1];
      const snippets = advancedTools.getCodeSnippet(category, null);
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'application/json',
            text: JSON.stringify(snippets, null, 2),
          },
        ],
      };
    }

    // Resource not found
    throw new Error(`Resource not found: ${uri}`);

  } catch (error) {
    return {
      contents: [
        {
          uri: uri,
          mimeType: 'text/plain',
          text: `Error reading resource: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});
```

---

### 9.5 Unifier makeApiRequest

**Créer nouveau fichier** : `n8n-api-client.js`

```javascript
import axios from 'axios';

class N8nApiClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: `${apiUrl}/api/v1`,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Retry logic
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        if (!config || !config.retry) {
          config.retry = 0;
        }

        if (config.retry >= 3) {
          return Promise.reject(error);
        }

        config.retry += 1;

        // Retry on network errors or 5xx errors
        if (!error.response || (error.response.status >= 500 && error.response.status < 600)) {
          await new Promise(resolve => setTimeout(resolve, 1000 * config.retry));
          return this.axiosInstance(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async request(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method: method,
        url: endpoint,
      };

      if (data) {
        if (method === 'GET') {
          config.params = data;
        } else {
          config.data = data;
        }
      }

      const response = await this.axiosInstance(config);
      return response.data;
    } catch (error) {
      // Enhanced error messages
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        if (status === 401) {
          throw new Error('Invalid API key. Please check your n8n API key configuration.');
        } else if (status === 404) {
          throw new Error(`Resource not found: ${endpoint}`);
        } else if (status === 400) {
          throw new Error(`Invalid request: ${message}`);
        } else if (status >= 500) {
          throw new Error(`n8n server error: ${message}`);
        }
      } else if (error.request) {
        throw new Error(`Network error: Cannot reach n8n instance at ${this.apiUrl}`);
      }

      throw error;
    }
  }

  // Convenience methods
  async get(endpoint, params = null) {
    return this.request(endpoint, 'GET', params);
  }

  async post(endpoint, data) {
    return this.request(endpoint, 'POST', data);
  }

  async put(endpoint, data) {
    return this.request(endpoint, 'PUT', data);
  }

  async patch(endpoint, data) {
    return this.request(endpoint, 'PATCH', data);
  }

  async delete(endpoint) {
    return this.request(endpoint, 'DELETE');
  }

  // Workflows
  async listWorkflows() {
    return this.get('/workflows');
  }

  async getWorkflow(workflowId) {
    return this.get(`/workflows/${workflowId}`);
  }

  async createWorkflow(workflowData) {
    return this.post('/workflows', workflowData);
  }

  async updateWorkflow(workflowId, workflowData) {
    return this.patch(`/workflows/${workflowId}`, workflowData);
  }

  async deleteWorkflow(workflowId) {
    return this.delete(`/workflows/${workflowId}`);
  }

  async executeWorkflow(workflowId, data = {}) {
    return this.post(`/workflows/${workflowId}/execute`, { data });
  }

  async activateWorkflow(workflowId) {
    return this.post(`/workflows/${workflowId}/activate`);
  }

  async deactivateWorkflow(workflowId) {
    return this.post(`/workflows/${workflowId}/deactivate`);
  }

  // Node Types
  async listNodeTypes() {
    return this.get('/node-types');
  }

  // Credentials (NEW)
  async listCredentials() {
    return this.get('/credentials');
  }

  async getCredential(credentialId) {
    return this.get(`/credentials/${credentialId}`);
  }

  async createCredential(credentialData) {
    return this.post('/credentials', credentialData);
  }

  async updateCredential(credentialId, credentialData) {
    return this.patch(`/credentials/${credentialId}`, credentialData);
  }

  async deleteCredential(credentialId) {
    return this.delete(`/credentials/${credentialId}`);
  }

  async testCredential(credentialId) {
    return this.post(`/credentials/${credentialId}/test`);
  }

  // Executions (NEW)
  async listExecutions(workflowId, options = {}) {
    const params = {
      workflowId: workflowId,
      limit: options.limit || 20,
      ...options
    };
    return this.get('/executions', params);
  }

  async getExecution(executionId) {
    return this.get(`/executions/${executionId}`);
  }

  async stopExecution(executionId) {
    return this.post(`/executions/${executionId}/stop`);
  }

  async deleteExecution(executionId) {
    return this.delete(`/executions/${executionId}`);
  }

  // Tags (NEW)
  async listTags() {
    return this.get('/tags');
  }

  async createTag(tagData) {
    return this.post('/tags', tagData);
  }

  async updateTag(tagId, tagData) {
    return this.patch(`/tags/${tagId}`, tagData);
  }

  async deleteTag(tagId) {
    return this.delete(`/tags/${tagId}`);
  }
}

export default N8nApiClient;
```

**Modifier index-complete.js** :
```javascript
// Ligne 1
import N8nApiClient from './n8n-api-client.js';

// Ligne 10-12
const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const apiClient = new N8nApiClient(N8N_API_URL, N8N_API_KEY);

// Supprimer makeApiRequest() (ligne 476-492)

// Modifier toutes les méthodes pour utiliser apiClient
async listWorkflows() {
  try {
    const workflows = await apiClient.listWorkflows();
    return {
      content: [
        {
          type: 'text',
          text: `Found ${workflows.data.length} workflows:\n\n` +
                workflows.data.map(w => `- ${w.name} (ID: ${w.id}) - ${w.active ? 'Active' : 'Inactive'}`).join('\n'),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// Etc. pour toutes les autres méthodes
```

---

### 9.6 Améliorer Sécurité

**Fichier** : `advanced-node-manipulation-tools.cjs`
**Ligne** : 636

**AVANT** :
```javascript
try {
  // Tenter de créer une fonction à partir du code
  new Function(code);
} catch (error) {
  validation.isValid = false;
  validation.errors.push(`Syntax error: ${error.message}`);
}
```

**APRÈS** :
```javascript
try {
  // Whitelist de variables et fonctions autorisées
  const allowedGlobals = [
    'items', 'item', '$input', '$json', '$binary', '$node',
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Date',
    'Math', 'JSON', 'console'
  ];

  // Blacklist de fonctions dangereuses
  const dangerousPatterns = [
    /require\s*\(/,
    /import\s+/,
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /child_process/,
    /fs\./,
    /process\./,
    /__dirname/,
    /__filename/,
    /\$env\./,  // Bloquer accès aux variables d'environnement
  ];

  // Vérifier patterns dangereux
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      validation.isValid = false;
      validation.errors.push(`Dangerous pattern detected: ${pattern}`);
      validation.suggestions.push('Remove calls to system functions, file system, or environment variables');
      return validation;
    }
  }

  // Sandbox le code
  const sandboxedCode = `
    (function() {
      'use strict';
      ${code}
    })();
  `;

  // Tenter de créer une fonction à partir du code
  new Function(...allowedGlobals, sandboxedCode);

  validation.detectedPatterns.push('Code passed security validation');
} catch (error) {
  validation.isValid = false;
  validation.errors.push(`Syntax error: ${error.message}`);
}
```

**Fichier** : `advanced-node-manipulation-tools.cjs`
**Ligne** : 447

**AVANT** :
```javascript
function validateN8nExpression(expression) {
  // ...
  // Vérifier si c'est une expression (commence par ={{)
  if (expression.startsWith('={{') && expression.endsWith('}}')) {
    const exprContent = expression.slice(3, -2);
    // ...
  }
}
```

**APRÈS** :
```javascript
function validateN8nExpression(expression) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    usedVariables: [],
    securityIssues: []
  };

  // Vérifier le format de base
  if (typeof expression !== 'string') {
    validation.isValid = false;
    validation.errors.push('Expression must be a string');
    return validation;
  }

  // Vérifier si c'est une expression (commence par ={{)
  if (expression.startsWith('={{') && expression.endsWith('}}')) {
    const exprContent = expression.slice(3, -2);

    // NOUVEAU : Vérifier patterns de sécurité
    const dangerousPatterns = [
      { pattern: /\$env\./g, issue: 'Access to environment variables ($env) is not allowed' },
      { pattern: /require\(/g, issue: 'require() calls are not allowed in expressions' },
      { pattern: /import\s+/g, issue: 'import statements are not allowed' },
      { pattern: /eval\(/g, issue: 'eval() is not allowed' },
      { pattern: /Function\(/g, issue: 'Function constructor is not allowed' },
      { pattern: /process\./g, issue: 'Access to process object is not allowed' },
    ];

    dangerousPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(exprContent)) {
        validation.isValid = false;
        validation.securityIssues.push(issue);
      }
    });

    // Détecter les variables utilisées (code existant)
    const variables = [
      '$json', '$binary', '$node', '$workflow', '$execution',
      '$now', '$today', '$prevNode', '$input', '$item'
    ];

    variables.forEach(variable => {
      if (exprContent.includes(variable)) {
        validation.usedVariables.push(variable);
      }
    });

    // Vérifier les accolades équilibrées
    const openBraces = (exprContent.match(/{/g) || []).length;
    const closeBraces = (exprContent.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      validation.warnings.push('Unbalanced braces in expression');
    }

  } else if (expression.includes('{{') || expression.includes('}}')) {
    validation.warnings.push('Expression may be malformed. Use ={{...}} format');
  }

  return validation;
}
```

---

### 9.7 Persister le cache

**Fichier** : `advanced-node-manipulation-tools.cjs`
**Après ligne** : 35

**AJOUTER** :
```javascript
const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, 'node-definition-cache.json');
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Charger le cache au démarrage
function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

      // Charger seulement les entrées non expirées
      Object.entries(cacheData).forEach(([nodeType, data]) => {
        const age = Date.now() - new Date(data.fetchedAt).getTime();
        if (age < CACHE_MAX_AGE) {
          nodeDefinitionCache.set(nodeType, data);
        }
      });

      console.log(`Loaded ${nodeDefinitionCache.size} node definitions from cache`);
    }
  } catch (error) {
    console.error('Error loading cache from disk:', error.message);
  }
}

// Sauvegarder le cache sur disque
function saveCacheToDisk() {
  try {
    const cacheObject = Object.fromEntries(nodeDefinitionCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObject, null, 2), 'utf8');
    console.log(`Saved ${nodeDefinitionCache.size} node definitions to cache`);
  } catch (error) {
    console.error('Error saving cache to disk:', error.message);
  }
}

// Charger au démarrage
loadCacheFromDisk();

// Sauvegarder toutes les 5 minutes
setInterval(saveCacheToDisk, 5 * 60 * 1000);

// Sauvegarder à l'arrêt du process
process.on('SIGINT', () => {
  saveCacheToDisk();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveCacheToDisk();
  process.exit(0);
});
```

**Modifier getNodeDefinitionFromN8n (ligne 92-93)** :
```javascript
// Mettre en cache
nodeDefinitionCache.set(nodeType, nodeDefinition);

// AJOUTER : Sauvegarder immédiatement sur disque pour ce nœud
saveCacheToDisk();

return nodeDefinition;
```

---

## 10. CONCLUSION ET RECOMMANDATIONS FINALES

### 10.1 État Actuel du Projet

**Points Forts** 🟢 :
1. ✅ **Système de fallback universel** : 100% de couverture des nœuds n8n
2. ✅ **Documentation riche** : 26 nœuds détaillés, 100+ exemples expressions, 30+ snippets
3. ✅ **3 versions adaptées** : Simple (5 outils), Avancée (18 outils), Enterprise (47 outils)
4. ✅ **Manipulation granulaire** : Outils uniques pour configuration fine des nœuds
5. ✅ **Conformité MCP SDK** : Tools bien implémentés avec handlers corrects
6. ✅ **Version enterprise complète** : RBAC, JWT, audit logs, templates, versioning

**Faiblesses** 🔴 :
1. ❌ **Configuration incohérente** : package.json pointe vers version basique
2. ❌ **Endpoints critiques manquants** : Credentials, executions, tags, users, webhooks
3. ❌ **MCP incomplet** : Resources et Prompts absents (sauf index-minimal)
4. ❌ **Sécurité insuffisante** : Validation minimale, pas de sanitization
5. ❌ **Documentation confuse** : 3 versions non expliquées clairement
6. ❌ **Pas d'unification** : 3 implémentations différentes de makeApiRequest

### 10.2 Score Global

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| Fonctionnalité | 7/10 | Bonnes bases, manque endpoints critiques |
| Conformité MCP | 6/10 | Tools OK, Resources/Prompts manquants |
| Sécurité | 4/10 | Basique dans index.js/complete, bonne dans minimal |
| Documentation | 8/10 | Excellente base technique, confusion sur versions |
| Performance | 8/10 | Cache efficace, mais non persistant |
| Maintenabilité | 5/10 | Code dupliqué, 3 versions différentes |
| **GLOBAL** | **6.3/10** | **Bon projet avec potentiel excellent** |

### 10.3 Roadmap Recommandée

**Phase 1 - URGENT (1-2 jours)** :
1. ✅ Fixer package.json (main: index-complete.js)
2. ✅ Ajouter credentials management (4 outils)
3. ✅ Ajouter executions management (3 outils)
4. ✅ Créer doc "QUELLE_VERSION_CHOISIR.md"

**Phase 2 - IMPORTANT (3-5 jours)** :
5. ✅ Implémenter MCP Resources dans index-complete.js
6. ✅ Implémenter MCP Prompts
7. ✅ Ajouter support webhooks
8. ✅ Unifier n8n-api-client.js

**Phase 3 - AMÉLIORATION (5-7 jours)** :
9. ✅ Renforcer sécurité (sanitization, validation)
10. ✅ Persister cache sur disque
11. ✅ Ajouter retry logic + timeout
12. ✅ Ajouter tags/users/variables endpoints

**Phase 4 - POLISH (3-5 jours)** :
13. ✅ Enrichir documentation (plus d'exemples)
14. ✅ Ajouter tests automatisés
15. ✅ Optimiser performance
16. ✅ Préparer release v3.0

### 10.4 Décision Architecturale Critique

**CHOIX À FAIRE** : Quelle version promouvoir ?

**Option A : index-complete.js** (Recommandé)
- ✅ Focus manipulation avancée nœuds
- ✅ Fallback universel
- ✅ Plus léger que index-minimal
- ❌ Pas de features enterprise (RBAC, etc.)
- **Public** : Développeurs individuels

**Option B : index-minimal.js**
- ✅ Features enterprise complètes
- ✅ 47 outils (vs 18)
- ✅ Sécurité robuste
- ❌ 8197 lignes (complexe)
- ❌ Pas de manipulation granulaire nœuds
- **Public** : Entreprises

**Option C : Fusionner**
- ✅ Meilleur des deux mondes
- ❌ Beaucoup de travail
- ❌ Risque de régression
- **Public** : Tous

**RECOMMANDATION** :
1. **Court terme** : Promouvoir index-complete.js (changer package.json)
2. **Moyen terme** : Backporter features enterprise dans index-complete.js
3. **Long terme** : Déprécier index-minimal.js, unifier sur index-complete.js

### 10.5 Comparaison Finale avec Concurrents

| Aspect | Notre projet | czlonkowski | leonardsellem |
|--------|--------------|-------------|---------------|
| **Nodes coverage** | 100% (fallback) | 99% (static) | Standard |
| **Tools count** | 18 (complete) | ~12 | ~13 |
| **Manipulation fine** | ✅ Excellent | ❌ Non | ❌ Non |
| **Validation** | ⚠️ Basic | ✅ Excellent | ⚠️ Basic |
| **Documentation** | ✅ Excellent | ✅ Excellent | ⚠️ Basic |
| **Webhooks** | ❌ Non | ❌ Non | ✅ Oui |
| **Credentials** | ❌ Non | ❓ ? | ❓ ? |
| **Resources MCP** | ⚠️ Partiel | ❓ ? | ✅ Oui |
| **Prompts MCP** | ❌ Non | ❓ ? | ❌ Non |
| **Enterprise** | ✅ index-minimal | ❌ Non | ❌ Non |

**NOTRE AVANTAGE UNIQUE** :
- ✅ Manipulation granulaire des nœuds (configure_node_parameters, etc.)
- ✅ Fallback universel dynamique (100% coverage automatique)
- ✅ Code snippets + expressions guide intégrés
- ✅ Version enterprise (index-minimal.js)

**À AJOUTER POUR ÊTRE #1** :
- ❌ Credentials management (czlonkowski l'a ?)
- ❌ Webhooks (leonardsellem l'a)
- ❌ Validation multi-niveaux (czlonkowski l'a)
- ❌ Resources MCP complet (leonardsellem l'a)

---

## ANNEXES

### Annexe A : Liste Complète des Outils par Version

**index.js (5 outils)** :
1. list_workflows
2. get_workflow
3. create_workflow
4. execute_workflow
5. list_node_types

**index-complete.js (18 outils)** :
1. list_workflows
2. get_workflow
3. create_workflow
4. update_workflow
5. delete_workflow
6. execute_workflow
7. list_node_types
8. describe_node_type
9. discover_node
10. configure_node_parameters
11. add_node_expression
12. configure_node_code
13. configure_node_credentials
14. get_code_snippet
15. validate_workflow_node
16. modify_single_node
17. add_nodes_to_workflow
18. remove_nodes_from_workflow

**index-minimal.js (47 outils)** :
1. list_workflows
2. list_node_types
3. create_workflow
4. activate_workflow
5. get_workflow
6. create_advanced_workflow
7. create_workflow_template
8. validate_workflow
9. execute_workflow
10. execution_list
11. execution_get
12. execution_stop
13. modify_single_node
14. add_nodes_to_workflow
15. remove_nodes_from_workflow
16. update_workflow_connections
17. clone_workflow_with_modifications
18. workflow_update
19. workflow_delete
20. analyze_workflow_structure
21. visualize_workflow_diagram
22. get_workflow_statistics
23. validate_workflow_before_update
24. suggest_workflow_improvements
25. create_smart_workflow
26. apply_workflow_template
27. workflow_diff
28. rollback_workflow
29. list_workflow_templates
30. authenticate_user
31. create_user
32. list_users
33. get_audit_logs
34. validate_token
35. logout_user
36. generate_resource_indicator
37. validate_resource_indicator
38. get_system_metrics
39. test_transport_security
40. health_check
41. browse_template_marketplace
42. create_workflow_from_template
43. publish_template
44. manage_workflow_versions
45. manage_environments
46. validate_workflow_best_practices
47. ai_debug_workflow

### Annexe B : Endpoints n8n API Disponibles

Selon documentation officielle n8n (https://docs.n8n.io/api/) :

**Workflows** :
- GET /api/v1/workflows
- GET /api/v1/workflows/:id
- POST /api/v1/workflows
- PATCH /api/v1/workflows/:id
- DELETE /api/v1/workflows/:id
- POST /api/v1/workflows/:id/execute
- POST /api/v1/workflows/:id/activate
- POST /api/v1/workflows/:id/deactivate

**Executions** :
- GET /api/v1/executions
- GET /api/v1/executions/:id
- DELETE /api/v1/executions/:id
- POST /api/v1/executions/:id/stop

**Credentials** :
- GET /api/v1/credentials
- GET /api/v1/credentials/:id
- POST /api/v1/credentials
- PATCH /api/v1/credentials/:id
- DELETE /api/v1/credentials/:id
- POST /api/v1/credentials/:id/test

**Tags** :
- GET /api/v1/tags
- POST /api/v1/tags
- PATCH /api/v1/tags/:id
- DELETE /api/v1/tags/:id

**Users** (Enterprise) :
- GET /api/v1/users
- GET /api/v1/users/:id
- POST /api/v1/users
- PATCH /api/v1/users/:id
- DELETE /api/v1/users/:id

**Variables** :
- GET /api/v1/variables
- POST /api/v1/variables
- PATCH /api/v1/variables/:id
- DELETE /api/v1/variables/:id

**Audit** (Enterprise) :
- GET /api/v1/audit

**Webhooks** :
- POST /webhook/:path
- GET /webhook/:path

**Node Types** :
- GET /api/v1/node-types

**Community Packages** :
- GET /api/v1/community-packages
- POST /api/v1/community-packages
- DELETE /api/v1/community-packages/:packageName

### Annexe C : Fichiers du Projet

```
n8n-claude-MCP-server/
├── index.js                              - Version basique (5 outils)
├── index-complete.js                     - Version avancée (18 outils)
├── index-minimal.js                      - Version enterprise (47 outils)
├── advanced-node-manipulation-tools.cjs  - Fonctions utilitaires avancées
├── package.json                          - Configuration npm
├── README.md                             - Documentation principale
├── FALLBACK_UNIVERSEL.md                 - Doc système fallback
├── RAPPORT_AUDIT_COMPLET.md              - Ce document
├── node-parameters-database.json         - Base de données 5 nœuds
├── node-parameters-extended.json         - Base de données 21 nœuds
├── N8N_EXPRESSIONS_GUIDE.md              - Guide expressions n8n
├── node-code-snippets.json               - Templates de code
└── node_modules/                         - Dépendances
```

### Annexe D : Variables d'Environnement

**Basiques** :
```bash
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

**Webhooks** (à ajouter) :
```bash
N8N_WEBHOOK_USERNAME=your_webhook_username
N8N_WEBHOOK_PASSWORD=your_webhook_password
```

**Enterprise (index-minimal.js)** :
```bash
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
SESSION_TIMEOUT=3600000
ENABLE_RBAC=true
ENABLE_AUDIT_LOG=true
ENABLE_MULTI_TENANT=false
ADMIN_PASSWORD=admin123
```

**MCP Security** :
```bash
MCP_SERVER_ID=uuid
MCP_NAMESPACE=urn:n8n:mcp:server
RESOURCE_INDICATOR_SECRET=secret
ENABLE_RESOURCE_INDICATORS=true
ENABLE_TRANSPORT_ENCRYPTION=true
```

**Rate Limiting** :
```bash
MAX_REQUEST_SIZE=10485760
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600000
ALLOWED_ORIGINS=*
```

---

**FIN DU RAPPORT D'AUDIT**

**Date** : 29 janvier 2025
**Analysé par** : Audit Technique Complet
**Version du projet** : 2.0.0
**Prochaine action recommandée** : Fixer package.json + Ajouter credentials management

---