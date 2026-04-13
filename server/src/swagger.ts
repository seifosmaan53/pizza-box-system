import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pizza Box Manager API',
      version: '1.0.0',
      description: 'Pizza box inventory and invoicing management system REST API',
      contact: { name: 'Pizza Box Co' },
    },
    servers: [
      { url: '/api', description: 'API base path' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Invalid input' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@company.com' },
            password: { type: 'string', example: 'Admin123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    role: { type: 'string', enum: ['VIEWER', 'MANAGER', 'ADMIN'] },
                  },
                },
              },
            },
          },
        },
        Store: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zipCode: { type: 'string' },
            contactName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            isActive: { type: 'boolean' },
            taxRate: { type: 'number' },
            defaultShippingFee: { type: 'number' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string', example: 'INV-2026-00001' },
            status: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE'] },
            total: { type: 'number' },
            currency: { type: 'string', example: 'USD' },
            issueDate: { type: 'string', format: 'date' },
            dueDate: { type: 'string', format: 'date' },
          },
        },
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            storeId: { type: 'string', format: 'uuid' },
            boxTypeId: { type: 'string', format: 'uuid' },
            boxSizeId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer' },
            lowStockThreshold: { type: 'integer' },
            pricePerUnit: { type: 'number' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with email and password',
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            401: { description: 'Invalid credentials' },
            429: { description: 'Account locked or rate limited' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token using refresh cookie',
          security: [],
          responses: {
            200: { description: 'New access token issued' },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout and invalidate refresh token',
          responses: { 200: { description: 'Logged out successfully' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          responses: { 200: { description: 'User profile' } },
        },
      },
      '/stores': {
        get: {
          tags: ['Stores'],
          summary: 'List all stores',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
          ],
          responses: { 200: { description: 'Paginated store list' } },
        },
        post: {
          tags: ['Stores'],
          summary: 'Create a new store (MANAGER+)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Store' } } } },
          responses: { 201: { description: 'Store created' } },
        },
      },
      '/stores/{id}': {
        get: {
          tags: ['Stores'],
          summary: 'Get store by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Store details' }, 404: { description: 'Not found' } },
        },
      },
      '/invoices': {
        get: {
          tags: ['Invoices'],
          summary: 'List invoices with filters',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE'] } },
            { name: 'storeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
          ],
          responses: { 200: { description: 'Paginated invoice list' } },
        },
        post: {
          tags: ['Invoices'],
          summary: 'Create a new invoice (MANAGER+)',
          responses: { 201: { description: 'Invoice created' } },
        },
      },
      '/invoices/{id}': {
        get: {
          tags: ['Invoices'],
          summary: 'Get invoice by ID with line items',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Invoice details' } },
        },
      },
      '/invoices/{id}/send': {
        post: {
          tags: ['Invoices'],
          summary: 'Send an invoice (validates stock, deducts inventory)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Invoice sent' }, 400: { description: 'Insufficient stock' } },
        },
      },
      '/invoices/{id}/pay': {
        post: {
          tags: ['Invoices'],
          summary: 'Mark invoice as paid',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Invoice marked as paid' } },
        },
      },
      '/invoices/{id}/pdf': {
        get: {
          tags: ['Invoices'],
          summary: 'Download invoice as PDF',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'PDF file', content: { 'application/pdf': {} } } },
        },
      },
      '/inventory': {
        get: {
          tags: ['Inventory'],
          summary: 'List all inventory items',
          responses: { 200: { description: 'Inventory list' } },
        },
      },
      '/inventory/warehouse': {
        get: {
          tags: ['Inventory'],
          summary: 'Get warehouse view (aggregated by box type/size)',
          responses: { 200: { description: 'Warehouse matrix' } },
        },
      },
      '/inventory/low-stock': {
        get: {
          tags: ['Inventory'],
          summary: 'Get items below low stock threshold',
          responses: { 200: { description: 'Low stock items' } },
        },
      },
      '/analytics/invoice-summary': {
        get: {
          tags: ['Analytics'],
          summary: 'Invoice status summary with totals',
          responses: { 200: { description: 'Invoice summary' } },
        },
      },
      '/analytics/sales-by-store': {
        get: {
          tags: ['Analytics'],
          summary: 'Sales breakdown by store',
          responses: { 200: { description: 'Sales data per store' } },
        },
      },
      '/users': {
        get: {
          tags: ['Users (Admin)'],
          summary: 'List all users (ADMIN only)',
          responses: { 200: { description: 'User list' } },
        },
        post: {
          tags: ['Users (Admin)'],
          summary: 'Create a new user (ADMIN only)',
          responses: { 201: { description: 'User created' } },
        },
      },
      '/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Get application settings',
          responses: { 200: { description: 'Settings' } },
        },
        put: {
          tags: ['Settings'],
          summary: 'Update settings (ADMIN only)',
          responses: { 200: { description: 'Settings updated' } },
        },
      },
    },
  },
  apis: [], // We define paths inline above
};

export const swaggerSpec = swaggerJsdoc(options);
