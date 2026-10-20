export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Pay&Go API',
    version: '0.1.0',
    description: 'API Express TypeScript de réservation et de paiement fictif. Les paiements ne traitent aucune carte réelle.',
  },
  servers: [
    { url: 'http://127.0.0.1:4000', description: 'Développement local' },
  ],
  tags: [
    { name: 'Health', description: 'État du service' },
    { name: 'Observability', description: 'Métriques Prometheus et signaux techniques' },
    { name: 'Auth', description: 'Inscription, connexion et sessions' },
    { name: 'Payments', description: 'Intentions de paiement, vérification SMTP et remboursements' },
    { name: 'Admin', description: 'Supervision et capacité du système de paiement' },
    { name: 'Chat', description: 'Assistant de réservation sécurisé' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Vérifier la disponibilité de l’API',
        responses: {
          '200': {
            description: 'Service disponible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Observability'],
        summary: 'Exposer les métriques Prometheus',
        responses: {
          '200': { description: 'Métriques au format Prometheus', content: { 'text/plain': { schema: { type: 'string' } } } },
        },
      },
    },
    '/v1/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Consulter l’état opérationnel du paiement',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Services, métriques et capacité courante', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOverviewResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/AdminRequired' },
        },
      },
    },
    '/v1/admin/scaling': {
      post: {
        tags: ['Admin'],
        summary: 'Ajuster le nombre de workers de paiement',
        description: 'Action bornée entre 1 et 10 workers. La queue mémoire applique immédiatement cette capacité.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScaleWorkersRequest' } } } },
        responses: {
          '200': { description: 'Capacité appliquée', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOverviewResponse' } } } },
          '400': { $ref: '#/components/responses/InvalidAdminRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/AdminRequired' },
        },
      },
    },
    '/v1/chat': {
      post: {
        tags: ['Chat'],
        summary: 'Demander une réponse à l’assistant Pay&Go',
        description: 'La clé du fournisseur reste côté API et n’est jamais envoyée au navigateur.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } } },
        responses: {
          '200': { description: 'Réponse de l’assistant', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
          '400': { description: 'Historique de messages invalide' },
          '422': { description: 'Question hors du périmètre Pay&Go' },
          '502': { description: 'Fournisseur de chat indisponible' },
          '503': { description: 'Assistant non configuré' },
        },
      },
    },
    '/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Créer un compte',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          '201': { description: 'Compte et session créés', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { $ref: '#/components/responses/InvalidAuthRequest' },
          '409': { description: 'Email déjà utilisé' },
        },
      },
    },
    '/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Ouvrir une session',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'Session créée', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { $ref: '#/components/responses/InvalidAuthRequest' },
          '401': { description: 'Identifiants invalides' },
        },
      },
    },
    '/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Récupérer le profil connecté',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Profil public', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Révoquer la session courante',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Session révoquée', content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/v1/payments/intents': {
      post: {
        tags: ['Payments'],
        summary: 'Créer ou rejouer une intention de paiement',
        description: 'Le serveur vérifie le devis, l’authentification et la clé d’idempotence. Un code SMTP fictif est généré après création.',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentRequest' } } } },
        responses: {
          '200': { description: 'Replay idempotent', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentIntentResponse' } } } },
          '202': { description: 'Intention créée', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentIntentResponse' } } } },
          '400': { $ref: '#/components/responses/InvalidPaymentRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Devis de réservation introuvable' },
          '409': { description: 'Clé d’idempotence réutilisée avec une requête différente' },
        },
      },
    },
    '/v1/payments/{paymentId}': {
      get: {
        tags: ['Payments'],
        summary: 'Consulter une intention de paiement',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/PaymentId' }],
        responses: {
          '200': { description: 'État du paiement', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Paiement introuvable pour cet utilisateur' },
        },
      },
    },
    '/v1/payments/{paymentId}/verify': {
      post: {
        tags: ['Payments'],
        summary: 'Vérifier le code SMTP fictif',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/PaymentId' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyPaymentRequest' } } } },
        responses: {
          '202': { description: 'Paiement placé en traitement', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentResponse' } } } },
          '400': { description: 'Code invalide' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Paiement introuvable pour cet utilisateur' },
          '409': { description: 'Code incorrect ou paiement non vérifiable' },
        },
      },
    },
    '/v1/payments/{paymentId}/refund': {
      post: {
        tags: ['Payments'],
        summary: 'Demander le remboursement d’un paiement',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/PaymentId' }],
        responses: {
          '202': { description: 'Remboursement placé en traitement', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Paiement introuvable pour cet utilisateur' },
          '409': { description: 'Paiement non remboursable' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'session-token' },
    },
    parameters: {
      IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, description: 'Clé unique de 16 à 128 caractères pour rendre les retries sûrs.', schema: { type: 'string', minLength: 16, maxLength: 128, example: 'demo-payment-key-20261026' } },
      PaymentId: { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', example: 'pi_123456' } },
    },
    responses: {
      Unauthorized: { description: 'Session absente, invalide ou expirée' },
      AdminRequired: { description: 'Le compte doit avoir le rôle admin' },
      InvalidAuthRequest: { description: 'Requête d’authentification invalide' },
      InvalidPaymentRequest: { description: 'Requête de paiement invalide' },
      InvalidAdminRequest: { description: 'Paramètres d’administration invalides' },
    },
    schemas: {
      HealthResponse: { type: 'object', required: ['status', 'service'], properties: { status: { type: 'string', example: 'ok' }, service: { type: 'string', example: 'payment-api' } } },
      RegisterRequest: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string', minLength: 2, maxLength: 80, example: 'Marie Dupont' }, email: { type: 'string', format: 'email', example: 'marie@example.test' }, password: { type: 'string', format: 'password', minLength: 8, example: 'mot-de-passe-demo' } } },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email', example: 'marie@example.test' }, password: { type: 'string', format: 'password', example: 'mot-de-passe-demo' } } },
      AvatarSvg: { type: 'string', pattern: '^<svg', maxLength: 20000, description: 'SVG d’identicon monochrome généré côté serveur à partir du profil utilisateur.' },
      PublicUser: { type: 'object', required: ['id', 'name', 'email', 'role', 'avatarSvg', 'createdAt'], properties: { id: { type: 'string', example: 'usr_123' }, name: { type: 'string', example: 'Marie Dupont' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['user', 'admin'], example: 'user' }, avatarSvg: { $ref: '#/components/schemas/AvatarSvg' }, createdAt: { type: 'string', format: 'date-time' } } },
      AuthResponse: { type: 'object', required: ['data'], properties: { data: { type: 'object', required: ['token', 'user'], properties: { token: { type: 'string', example: 'session-token' }, user: { $ref: '#/components/schemas/PublicUser' } } } } },
      UserResponse: { type: 'object', required: ['data'], properties: { data: { $ref: '#/components/schemas/PublicUser' } } },
      LogoutResponse: { type: 'object', required: ['data'], properties: { data: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean', example: true } } } } },
      PaymentMethod: { type: 'object', required: ['token', 'last4', 'brand', 'email'], properties: { token: { type: 'string', pattern: '^pm_mock_', example: 'pm_mock_demo-1234567' }, last4: { type: 'string', pattern: '^\\d{4}$', example: '4242' }, brand: { type: 'string', enum: ['visa', 'mastercard', 'amex', 'other'], example: 'visa' }, email: { type: 'string', format: 'email', example: 'marie@example.test' } } },
      CreatePaymentRequest: { type: 'object', required: ['bookingId', 'amountCents', 'currency', 'paymentMethod'], properties: { bookingId: { type: 'string', pattern: '^booking_\\d+$', example: 'booking_1' }, amountCents: { type: 'integer', minimum: 1, example: 3900 }, currency: { type: 'string', enum: ['EUR'] }, paymentMethod: { $ref: '#/components/schemas/PaymentMethod' } } },
      VerifyPaymentRequest: { type: 'object', required: ['code'], properties: { code: { type: 'string', pattern: '^\\d{6}$', example: '123456' } } },
      Payment: { type: 'object', required: ['id', 'bookingId', 'amountCents', 'currency', 'status', 'paymentMethodLast4', 'paymentMethodBrand', 'createdAt', 'updatedAt'], properties: { id: { type: 'string', example: 'pi_123456' }, bookingId: { type: 'string', example: 'booking_1' }, amountCents: { type: 'integer', example: 3900 }, currency: { type: 'string', enum: ['EUR'] }, status: { type: 'string', enum: ['awaiting_verification', 'pending', 'processing', 'succeeded', 'failed', 'refund_pending', 'refunded'] }, paymentMethodLast4: { type: 'string', example: '4242' }, paymentMethodBrand: { type: 'string', enum: ['visa', 'mastercard', 'amex', 'other'] }, providerReference: { type: 'string' }, failureCode: { type: 'string' }, verifiedAt: { type: 'string', format: 'date-time' }, refundReference: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      PaymentIntentResponse: { type: 'object', required: ['data', 'idempotentReplay'], properties: { data: { $ref: '#/components/schemas/Payment' }, idempotentReplay: { type: 'boolean' }, verification: { type: 'object', properties: { channel: { type: 'string', example: 'smtp' }, demoCode: { type: 'string', example: '123456' } } } } },
      PaymentResponse: { type: 'object', required: ['data'], properties: { data: { $ref: '#/components/schemas/Payment' } } },
      ScaleWorkersRequest: { type: 'object', required: ['workerCount'], properties: { workerCount: { type: 'integer', minimum: 1, maximum: 10, example: 3 } } },
      AdminService: { type: 'object', required: ['name', 'key', 'status', 'detail'], properties: { name: { type: 'string' }, key: { type: 'string' }, status: { type: 'string', enum: ['operational', 'degraded', 'down'] }, detail: { type: 'string' } } },
      AdminOverview: { type: 'object', required: ['generatedAt', 'services', 'metrics', 'scaling'], properties: { generatedAt: { type: 'string', format: 'date-time' }, services: { type: 'array', items: { $ref: '#/components/schemas/AdminService' } }, metrics: { type: 'object', properties: { users: { type: 'integer' }, payments: { type: 'integer' }, paymentStatuses: { type: 'object', additionalProperties: { type: 'integer' } }, queue: { type: 'object', properties: { depth: { type: 'integer' }, workerCount: { type: 'integer' }, activeWorkers: { type: 'integer' } } } } }, scaling: { type: 'object', properties: { minWorkers: { type: 'integer' }, maxWorkers: { type: 'integer' }, workerCount: { type: 'integer' } } } } },
      AdminOverviewResponse: { type: 'object', required: ['data'], properties: { data: { $ref: '#/components/schemas/AdminOverview' } } },
      ChatMessage: { type: 'object', required: ['role', 'content'], properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string', minLength: 1, maxLength: 1000 } } },
      ChatRequest: { type: 'object', required: ['messages'], properties: { messages: { type: 'array', minItems: 1, maxItems: 12, items: { $ref: '#/components/schemas/ChatMessage' } } } },
      ChatResponse: { type: 'object', required: ['data'], properties: { data: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } },
    },
  },
} as const;
