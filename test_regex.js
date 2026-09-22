const str = "5:1";
const match1 = str.match(/^(?:chapter\s+)?\d+(?:\s+(?:verses?|to|through|and|-|:)\s*\d+|\s+\d+)*\b/i);
const match2 = str.match(/^(?:chapter\s+)?\d+(?:\s*(?:verses?|to|through|and|-|:)\s*\d+|\s+\d+)*\b/i);
console.log("Old regex:", match1[0]);
console.log("New regex:", match2[0]);
