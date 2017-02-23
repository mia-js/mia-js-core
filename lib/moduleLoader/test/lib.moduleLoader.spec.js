describe("Module loader", function () {
    var pathToModule = "./../../moduleLoader";
    var ModuleLoader = require(pathToModule);
    it("must be available at '" + pathToModule + "'", function (next) {
        expect(ModuleLoader).toBeDefined();
        next();
    });

    var dirName = process.cwd() + '/node_modules/' + pathToModule + "/test/testData";
    describe("In {'optional', 'tree'} mode it", function () {

        var modules;
        it("must run if a directory is set correctly: '" + dirName + "'", function (next) {

            //load modules
            expect(function () {
                modules = ModuleLoader.optional({
                    dirName: dirName,
                    filter: /(.+)\.(js)$/,
                    mode: 'tree'
                });
            }).not.toThrow();
            expect(modules).toBeDefined();

            next();
        });

        it("must load modules correctly", function (next) {

            expect(modules.sysTem).toBeDefined();
            expect(modules.policies).toBeDefined();
            expect(modules.subDir1).toBeDefined();
            expect(modules.subDir1.adapters).toBeDefined();
            expect(modules.subDir1.defaultValues).toBeDefined();

            next();
        });

        describe("Loaded modules", function () {
            it("must contain data", function (next) {

                expect(modules.policies.userController).toBeDefined();
                expect(modules.policies.sessionController).toBeDefined();

                next();
            });

            it("must contain correct identities", function (next) {

                expect(modules.policies.identity).toEqual('policies');
                expect(modules.sysTem.identity).toEqual('sysTem');
                expect(modules.subDir1.adapters.identity).toEqual('adapters');
                expect(modules.subDir1.defaultValues.identity).toEqual('defaultValues');

                next();
            });

            it("must contain correct relative paths", function (next) {
                expect(modules.policies.relativePath).toEqual('/');
                expect(modules.sysTem.relativePath).toEqual('/');
                expect(modules.subDir1.adapters.relativePath).toEqual('/subDir1');
                expect(modules.subDir1.defaultValues.relativePath).toEqual('/subDir1');

                next();
            });

            it("must contain correct absolute paths", function (next) {
                expect(modules.policies.absolutePath).toEqual(dirName);
                expect(modules.sysTem.absolutePath).toEqual(dirName);
                expect(modules.subDir1.adapters.absolutePath).toEqual(dirName + '/subDir1');
                expect(modules.subDir1.defaultValues.absolutePath).toEqual(dirName + '/subDir1');

                next();
            });

            it("must contain correct file names", function (next) {
                expect(modules.policies.fileName).toEqual('policies.js');
                expect(modules.sysTem.fileName).toEqual('sysTem.js');
                expect(modules.subDir1.adapters.fileName).toEqual('adapters.js');
                expect(modules.subDir1.defaultValues.fileName).toEqual('defaultValues.js');

                next();
            });
        });

    });
});