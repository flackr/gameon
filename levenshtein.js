(function(exports, scope) {

  // Returns the Levenshtein distance (edit distance) between s1 and s2.
  exports.distance = function(s1, s2) {
    let d = [];
    for (let i = 0; i <= s1.length; ++i)
      d[i] = [i];
    for (let j = 0; j <= s2.length; ++j)
      d[0][j] = j;
    for (let i = 1; i <= s1.length; ++i) {
      for (let j = 1; j <= s2.length; ++j) {
        d[i][j] = Math.min(
            d[i - 1][j - 1] + (s1[i - 1] == s2[j - 1] ? 0 : 1),
            d[i - 1][j] + 1,
            d[i][j - 1] + 1);
      }
    }
    return d[s1.length][s2.length];
  }

})(typeof exports === 'undefined' ? this['Levenshtein'] = {} : exports, this);