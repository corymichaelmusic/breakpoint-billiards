import { LogBox } from 'react-native';

if (__DEV__) {
    const ignoreWarns = [
        "SafeAreaView has been deprecated",
    ];

    const warn = console.warn;
    console.warn = (...arg) => {
        for (const warning of ignoreWarns) {
            if (arg.some(a => typeof a === 'string' && a.includes(warning))) {
                return;
            }
        }
        warn(...arg);
    };

    LogBox.ignoreLogs(ignoreWarns);
}
