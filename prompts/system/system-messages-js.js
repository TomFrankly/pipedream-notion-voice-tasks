const fs = require('fs')

function constructSystemMessages(inputPaths, outputPath) {
    let result = {
        en: {},
    }

    for (let file of inputPaths) {
        let data = fs.readFileSync(file, 'utf8')

        let filename = file.replace(/\.\//g, '').replace(/\.txt/g, '')

        let json = data.replace(/"/g, '\"').replace(/\n/g, '\n').replace(/\r/g, '\r');

        result.en[filename] = json
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
}

const files = [
    './round_1.txt',
    './round_2.txt',
    './round_3.txt',
    './gpt_4.txt',
]

constructSystemMessages(files, './system-messages.json')



