const fs = require('fs');
const path = require('path');

console.log('🩹 Running Custom Reanimated Fixer...');

// 1. Fix ReanimatedPackage.java (Systrace Issue)
const packagePath = path.join('node_modules', 'react-native-reanimated', 'android', 'src', 'main', 'java', 'com', 'swmansion', 'reanimated', 'ReanimatedPackage.java');

if (fs.existsSync(packagePath)) {
    let content = fs.readFileSync(packagePath, 'utf8');
    const originalLength = content.length;

    // Comment out Systrace.beginSection
    content = content.replace(
        /Systrace\.beginSection\(Systrace\.TRACE_TAG_REACT_JAVA_BRIDGE/g,
        '// Systrace.beginSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE'
    );

    // Comment out Systrace.endSection
    content = content.replace(
        /Systrace\.endSection\(Systrace\.TRACE_TAG_REACT_JAVA_BRIDGE/g,
        '// Systrace.endSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE'
    );

    if (content.length !== originalLength) {
        fs.writeFileSync(packagePath, content);
        console.log('✅ Patched ReanimatedPackage.java');
    } else {
        console.log('ℹ️  ReanimatedPackage.java already patched or content removed.');
    }
} else {
    console.error('❌ Could not find ReanimatedPackage.java at:', packagePath);
}

// 2. Fix BorderRadiiDrawableUtils.java (Float Casting & Chaining Issue)
const utilsBaseDir = path.join('node_modules', 'react-native-reanimated', 'android', 'src', 'reactNativeVersionPatch', 'BorderRadiiDrawableUtils');

function patchUtilsRecursive(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            patchUtilsRecursive(fullPath);
        } else if (file === 'BorderRadiiDrawableUtils.java') {
            let content = fs.readFileSync(fullPath, 'utf8');

            // We want to replace the ENTIRE broken chain.
            // Original broken state: length.resolve(bounds.width(), bounds.height()).toPixelFromDIP().getHorizontal()
            // Intermediate broken state: length.resolve((float)bounds.width()).toPixelFromDIP().getHorizontal()
            // Target state: length.resolve((float)bounds.width())

            let patched = false;

            // Check for Original State (Clean install)
            if (content.includes('length.resolve(bounds.width(), bounds.height()).toPixelFromDIP().getHorizontal()')) {
                content = content.replace(
                    'length.resolve(bounds.width(), bounds.height()).toPixelFromDIP().getHorizontal()',
                    'length.resolve((float)bounds.width())'
                );
                patched = true;
                console.log(`✅ Patched BorderRadiiDrawableUtils.java (from clean state)`);
            }
            // Check for Intermediate State (Partial patch)
            else if (content.includes('length.resolve((float)bounds.width()).toPixelFromDIP().getHorizontal()')) {
                content = content.replace(
                    'length.resolve((float)bounds.width()).toPixelFromDIP().getHorizontal()',
                    'length.resolve((float)bounds.width())'
                );
                patched = true;
                console.log(`✅ Fixed previous incomplete patch in BorderRadiiDrawableUtils.java`);
            }
            // Check for Mixed State (Double args but still has chain)
            else if (content.includes('length.resolve((float)bounds.width(), (float)bounds.height()).toPixelFromDIP().getHorizontal()')) {
                content = content.replace(
                    'length.resolve((float)bounds.width(), (float)bounds.height()).toPixelFromDIP().getHorizontal()',
                    'length.resolve((float)bounds.width())'
                );
                patched = true;
                console.log(`✅ Fixed mixed state patch in BorderRadiiDrawableUtils.java`);
            }

            if (patched) {
                fs.writeFileSync(fullPath, content);
            } else {
                // Verification: call this "good" if we see the target string and NOT the bad chain
                if (content.includes('length.resolve((float)bounds.width())') && !content.includes('.toPixelFromDIP()')) {
                    console.log(`ℹ️  BorderRadiiDrawableUtils.java is already correctly patched.`);
                } else {
                    // Only warn if we can't find the target AT ALL (might be different file version?)
                    // console.log(`⚠️  Could not find target string in ${file}. Checking other files...`);
                }
            }
        }
    }
}

if (fs.existsSync(utilsBaseDir)) {
    patchUtilsRecursive(utilsBaseDir);
} else {
    console.error('❌ Could not find BorderRadiiDrawableUtils directory at:', utilsBaseDir);
}

// 3. Fix plugin/index.js (Worklets Require Issue in Babel)
const pluginPath = path.join('node_modules', 'react-native-reanimated', 'plugin', 'index.js');
if (fs.existsSync(pluginPath)) {
    let content = fs.readFileSync(pluginPath, 'utf8');

    // The error is: Cannot find module 'react-native-worklets/plugin'
    if (content.includes("require('react-native-worklets/plugin')")) {
        content = content.replace(
            "require('react-native-worklets/plugin')",
            "{}"
        );
        fs.writeFileSync(pluginPath, content);
        console.log(`✅ Patched plugin/index.js (Removed worklets require)`);
    } else if (content.includes('react-native-worklets/plugin')) {
        content = content.replace(
            /require\(['"]react-native-worklets\/plugin['"]\)/g,
            "{}"
        );
        fs.writeFileSync(pluginPath, content);
        console.log(`✅ Patched plugin/index.js (Removed worklets require via regex)`);
    } else {
        console.log(`ℹ️  plugin/index.js does not contain worklets require.`);
    }
}

// 4. Fix CMakeLists.txt (Remove -Werror to allow deprecation warnings)
const cmakePath = path.join('node_modules', 'react-native-reanimated', 'android', 'CMakeLists.txt');
if (fs.existsSync(cmakePath)) {
    let content = fs.readFileSync(cmakePath, 'utf8');
    if (content.includes('-Werror')) {
        content = content.replace(/-Werror/g, '');
        fs.writeFileSync(cmakePath, content);
        console.log('✅ Patched CMakeLists.txt (Removed -Werror)');
    } else {
        console.log('ℹ️  CMakeLists.txt does not contain -Werror.');
    }
} else {
    // console.error('❌ Could not find CMakeLists.txt at:', cmakePath);
}
