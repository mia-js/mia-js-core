module.exports = {

    // Default policies all actions of all controllers
    '*': ['isRegistered'],

    sessionController: {

        // Default policies for actions of this controller
        '*': false,

        // Policy for action index
        index: ['isAuth'],

        // Policy for action update
        update: ['isAuth','isCool']
    },

    userController: {
        index: 'isAuth'
    }
};