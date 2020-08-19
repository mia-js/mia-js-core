var BaseModel = require("./../../../baseModel");

module.exports = BaseModel.extend({
        data: {
            id: {
                type: String
            },
            productId: {
                type: String
            },
            path: {
                type: Array,
                index: true
            },
            createdAt: {
                type: Date
            },
            modifiedAt: {
                type: Date
            },
            userId: {
                type: String
            },
            userName: {
                type: String
            },
            version: {
                type: String
            },
            cacheTime: {
                type: Number,
                default: 300
            },
            ui: {}
        }
    },
    {
        disabled: false,
        identity: 'Complex-Model',
        version: '1.0',
        created: '2020-08-19T10:00:00',
        modified: '2020-08-19T10:00:00',
        collectionName: 'ui'
    }
)
