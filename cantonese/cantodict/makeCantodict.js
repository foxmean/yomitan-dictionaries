const csv = require('csvtojson');
const fs = require('fs');

const saveDict = require('../../util/saveDict');

// const saveDict = require('../util/saveDict');
const folderPath = 'cantonese/cantodict/';
const csvPath = 'cantodict.csv';

const READING_TYPE = 'jyutping';

// make three dicts - one for terms, one for characters (as a kanji dict), one for sentence examples for characters/terms.

(async function () {
  const rawCantoDict = await csv().fromFile(folderPath + csvPath);
  const cantodict = {};

  // parse json from relevant fields
  const jsonFields = [
    'cantodict_id',
    'similar',
    'variants',
    'pos',
    'flag',
    'compound_cantodictids',
    'sentence_cantodictids',
    'character_cantodictids',
    'google_frequency',
  ];
  // put into object with cantodict id as key
  for (const entry of rawCantoDict) {
    for (const field of jsonFields) {
      if (entry[field]) {
        entry[field] = JSON.parse(entry[field]);
      }
    }
    cantodict[entry.entry_type + ',' + entry.cantodict_id] = entry;
  }

  const termBank = createTermBank(cantodict);

  const index = {
    title: 'CantoDict',
    revision: `cantodict_${new Date().toISOString()}`,
    format: 3,
    url: 'http://www.cantonese.sheik.co.uk/',
    description: `CantoDict was a Cantonese-English dictionary created and maintained by public contributors. It was abandoned, but the data was archived thanks to awong-dev at https://github.com/awong-dev/cantodict-archive.
Created with https://github.com/MarvNC/yomichan-dictionaries`,
    author: 'CantoDict contributors, Marv',
    attribution: 'CantoDict contributors',
    frequencyMode: 'rank-based',
  };

  saveDict(
    {
      'index.json': index,
      'term_bank_1.json': termBank,
    },
    '[Cantonese] CantoDict.zip'
  );
})();

/**
 * Creates a term bank of all terms from the cantodict object
 * @param {Object} cantodict
 */
function createTermBank(cantodict) {
  const termBank = [];
  for (const key of Object.keys(cantodict)) {
    const entry = cantodict[key];
    if (entry.entry_type === 'compound' || entry.entry_type === 'character') {
      const termBankEntries = createTermBankEntries(entry, cantodict);
      termBank.push(...termBankEntries);
    }
  }
  return termBank;
}

/**
 * Creates Yomichan term bank entries from a cantodict entry which can be either a term or a character.
 * References the cantodict to get example sentences.
 * @param {Object} entry
 * @param {Object} cantodict
 */
function createTermBankEntries(entry, cantodict) {
  const entries = [];

  const termBankEntry = [];
  termBankEntry.push(entry.chinese);
  termBankEntry.push(entry[READING_TYPE]);
  termBankEntry.push(entry.pos.join(' '));
  termBankEntry.push('');
  termBankEntry.push(entry.google_frequency || 0);
  const definitionStructuredContent = {
    type: 'structured-content',
    content: [
      // render headword in HK font
      {
        tag: 'span',
        data: {
          cantodict: 'headword',
        },
        content: [
          {
            tag: 'span',
            content: '【',
            style: {
              fontSize: '150%',
            },
          },
          {
            tag: 'span',
            content: entry.chinese,
            style: {
              fontSize: '150%',
            },
            data: {
              cantodict: 'chinese',
            },
          },
          // variants
          entry.variants && entry.variants.length > 0
            ? {
                tag: 'span',
                content: `・${entry.variants.join('・')}`,
                style: {
                  fontSize: '150%',
                },
                data: {
                  cantodict: 'variants',
                },
              }
            : { tag: 'span' },
          {
            tag: 'span',
            content: '】',
            style: {
              fontSize: '150%',
            },
          },
          {
            tag: 'span',
            content: `${entry.jyutping}・${entry.yale}・${entry.pinyin}`,
            data: {
              cantodict: 'readings',
            },
          },
        ],
        lang: 'zh-HK',
      },
      {
        tag: 'ul',
        data: {
          cantodict: 'definition',
        },
        content: [
          ...entry.definition.split('\n').map((def) => ({
            tag: 'li',
            content: def,
          })),
        ],
        style: {
          listStyleType: 'circle',
        },
        lang: 'zh-HK',
      },
      // note if entry has note
      entry.notes
        ? {
            tag: 'ul',
            data: {
              cantodict: 'notes',
            },
            content: [
              {
                tag: 'li',
                content: entry.notes,
              },
            ],
            style: {
              listStyleType: '"📝 "',
            },
            lang: 'zh-HK',
          }
        : { tag: 'span' },
    ],
  };

  // add compounds
  if (entry.compound_cantodictids.length > 0) {
    const compounds = [];
    const content = {
      tag: 'div',
      data: {
        cantodict: 'compounds',
      },
      content: [],
      lang: 'zh-HK',
    };
    for (const compoundId of entry.compound_cantodictids) {
      const compound = cantodict['compound,' + compoundId];
      if (compound) {
        compounds.push(
          {
            tag: 'a',
            href: `?query=${compound.chinese}&wildcards=off`,
            content: compound.chinese,
          },
          {
            tag: 'span',
            content: '・',
          }
        );
      }
    }
    // remove last separator from compounds array
    compounds.pop();
    content.content.push(...compounds);
    definitionStructuredContent.content.push(content);
  }

  // add sentences
  if (entry.sentence_cantodictids.length > 0) {
    const sentences = [];
    const content = {
      tag: 'ul',
      data: {
        cantodict: 'sentences',
      },
      content: [],
      style: {
        listStyleType: 'square',
      },
      lang: 'zh-HK',
    };
    for (const sentenceId of entry.sentence_cantodictids) {
      const sentence = cantodict['sentence,' + sentenceId];
      if (sentence) {
        sentences.push(
          {
            content: sentence.chinese,
            tag: 'li',
          },
          {
            content: sentence.definition,
            lang: 'en',
            style: {
              fontSize: '80%',
              listStyleType: 'none',
            },
            tag: 'li',
          }
        );
      }
    }
    content.content.push(...sentences);
    definitionStructuredContent.content.push(content);
  }

  termBankEntry.push([definitionStructuredContent]);

  // sequence number
  termBankEntry.push(0);
  // tags, add dialects
  termBankEntry.push(entry.dialect ?? '');

  entries.push(termBankEntry);

  // handle variants
  if (entry.variants.length > 0) {
    for (const variant of entry.variants) {
      // copy term bank entry and replace the term with the variant
      const variantEntry = [...termBankEntry];
      variantEntry[0] = variant;
      entries.push(variantEntry);
    }
  }

  return entries;
}

/**
 * Creates a yomichan kanji bank from a character entry.
 * @param {Object} entry
 * @param {Object} cantodict
 */
function createKanjiBankEntry(entry, cantodict) {}
