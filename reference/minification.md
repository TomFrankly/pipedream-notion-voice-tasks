# Minification

To minify the Notion-Voice-Tasks.js code for use in Pipedream:

1. Paste it into the [SWC Playground](https://swc.rs/playground) with the following options:
    1. Language: JavaScript
    2. Target: ES2015
    3. Module: ES Modules
    4. Source Type: Module
    5. JSX off
    6. Loose off
    7. Minify on
    8. Compress on, default
    9. Mangle on, default
    10. Env Targets on
    11. Bugfixes off
    12. Version: 1.3.70 (later versions will not work)
2. Copy the output and paste it into [MinifyJS](https://codebeautify.org/minify-js#) in order to compress all the template literal strings.
3. Copy the MinifyJS output and paste into a Pipedream action, replacing all default code.