
require('shelljs');
var fs = require('fs');
var os = require('os');
var path = require('path');
var process = require('process');
var ncp = require('child_process');
var syncRequest = require('sync-request');

var downloadPath = path.join(__dirname, '_download');
var testPath = path.join(__dirname, '_test');

var makeOptions = require('./make-options.json');

var banner = function (message, noBracket) {
    console.log();
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log(message);
    if (!noBracket) {
        console.log('------------------------------------------------------------');
    }
    console.log();
}
exports.banner = banner;

var rp = function (relPath) {
    return path.join(pwd() + '', relPath);
}
exports.rp = rp;

var fail = function (message) {
    console.error('ERROR: ' + message);
    process.exit(1);
}
exports.fail = fail;

var ensureExists = function (checkPath) {
    var exists = test('-d', checkPath) || test('-f', checkPath);

    if (!exists) {
        fail(checkPath + ' does not exist');
    }
}
exports.ensureExists = ensureExists;

var pathExists = function (checkPath) {
    return test('-d', checkPath) || test('-f', checkPath);
}
exports.pathExists = pathExists;

var buildNodeTask = function (taskPath, outDir) {
    banner('Building node task ' + taskPath, true);
    pushd(taskPath);
    if (test('-f', rp('package.json'))) {
        console.log('installing node modules');
        run('npm install');
    }
    run('tsc --outDir ' + outDir);

    popd();
}
exports.buildNodeTask = buildNodeTask;

var copyTaskResources = function (srcPath, destPath) {
    // copy task resources
    var toCopy = makeOptions['taskResources'];
    toCopy.forEach(function (item) {
        var itemPath = path.join(srcPath, item);

        if (pathExists(itemPath)) {
            cp('-R', itemPath, destPath);
        }
    });
}
exports.copyTaskResources = copyTaskResources;

exports.run = function (cl, echo) {
    console.log();
    console.log('> ' + cl);
    var rc = 0;
    try {
        var output = ncp.execSync(cl);

        if (output && (echo || process.env['TASK_BUILD_VERBOSE'])) {
            console.log(output.toString());
        }
    }
    catch (err) {
        exit(1);
    }
}
var run = exports.run;

var ensureTool = function (name, versionArgs) {
    console.log(name + ' tool:');
    var toolPath = which(name);
    if (!toolPath) {
        fail(name + ' not found.  might need to run npm install');
    }

    exec(name + ' ' + versionArgs);
    console.log(toolPath + '');
}
exports.ensureTool = ensureTool;

var downloadFile = function (url) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'file', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        console.log('Downloading file: ' + url);

        // delete any previous partial attempt
        if (test('-f', targetPath)) {
            rm('-f', targetPath);
        }

        // download the file
        mkdir('-p', path.join(downloadPath, 'file'));
        var result = syncRequest('GET', url);
        fs.writeFileSync(targetPath, result.getBody());

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

var downloadArchive = function (url, omitExtensionCheck) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    if (!omitExtensionCheck && !url.match(/\.zip$/)) {
        throw new Error('Expected .zip');
    }

    // skip if already downloaded and extracted
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!test('-f', marker)) {
        // download the archive
        var archivePath = downloadFile(url);
        console.log('Extracting archive: ' + url);

        // delete any previously attempted extraction directory
        if (test('-d', targetPath)) {
            rm('-rf', targetPath);
        }

        // extract
        mkdir('-p', targetPath);
        var zip = new admZip(archivePath);
        zip.extractAllTo(targetPath);

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

var addPath = function (directory) {
    var separator;
    if (os.platform() == 'win32') {
        separator = ';';
    }
    else {
        separator = ':';
    }

    var existing = process.env['PATH'];
    if (existing) {
        process.env['PATH'] = directory + separator + existing;
    }
    else {
        process.env['PATH'] = directory;
    }
}
exports.addPath = addPath;
