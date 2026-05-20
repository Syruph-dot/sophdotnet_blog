// ════════════════════════════════════════════════════════════════
// Article analysis engine for blog (ported from analyzer.html)
// ════════════════════════════════════════════════════════════════

// Create tooltip
(function() {
  var tip = document.createElement('div');
  tip.className = 'analysis-tooltip';
  tip.id = 'blogAnalysisTooltip';
  document.body.appendChild(tip);
})();

// 1. Reference profile data (from HC3 corpus)
var REF = {
  human: {
    scalar: {
      final_entropy:          { mean: 7.1202, std: 0.2882 },
      local_entropy_mean:     { mean: 7.0106, std: 0.2057 },
      local_entropy_std:      { mean: 0.0406, std: 0.0801 },
      compression_ratio_zlib: { mean: 0.5944, std: 0.0653 },
      punctuation_ratio:      { mean: 0.0935, std: 0.0239 },
      avg_line_length:        { mean: 205.77, std: 115.66 },
      para_entropy:           { mean: 2.5865, std: 0.2137 },
      unique_ratio:           { mean: 0.4049, std: 0.0825 },
    },
    curve: {
      mean: [6.7635,6.7635,6.7635,6.7635,6.7635,6.7622,6.7608,6.7589,6.7549,6.7508,6.7454,6.7399,6.7339,6.7276,6.7217,6.7177,6.7153,6.7110,6.7068,6.7001,6.6924,6.6880,6.6823,6.6773,6.6738,6.6699,6.6665,6.6628,6.6574,6.6492,6.6380,6.6262,6.6134,6.6016,6.5919,6.5847,6.5805,6.5717,6.5627,6.5539,6.5471,6.5358,6.5246,6.5146,6.5058,6.4979,6.4902,6.4824,6.4753,6.4686],
      std:  [0.1882,0.1882,0.1882,0.1882,0.1882,0.1882,0.1881,0.1881,0.1884,0.1885,0.1886,0.1889,0.1893,0.1897,0.1899,0.1902,0.1902,0.1904,0.1906,0.1906,0.1906,0.1908,0.1910,0.1912,0.1914,0.1915,0.1916,0.1917,0.1917,0.1916,0.1915,0.1915,0.1916,0.1918,0.1920,0.1924,0.1926,0.1925,0.1924,0.1925,0.1926,0.1927,0.1928,0.1930,0.1931,0.1933,0.1935,0.1936,0.1937,0.1938],
      q25:  [6.6057,6.6057,6.6057,6.6057,6.6057,6.6040,6.6026,6.6004,6.5969,6.5935,6.5890,6.5840,6.5787,6.5728,6.5678,6.5643,6.5626,6.5589,6.5553,6.5490,6.5397,6.5355,6.5295,6.5246,6.5213,6.5176,6.5144,6.5108,6.5057,6.4970,6.4840,6.4715,6.4580,6.4463,6.4372,6.4302,6.4262,6.4187,6.4101,6.4015,6.3954,6.3849,6.3744,6.3644,6.3548,6.3456,6.3361,6.3272,6.3185,6.3110],
      q75:  [6.9170,6.9170,6.9170,6.9170,6.9170,6.9158,6.9148,6.9131,6.9090,6.9043,6.8983,6.8924,6.8853,6.8784,6.8714,6.8668,6.8640,6.8594,6.8548,6.8483,6.8425,6.8380,6.8331,6.8286,6.8246,6.8208,6.8168,6.8124,6.8066,6.7989,6.7898,6.7796,6.7685,6.7571,6.7469,6.7395,6.7355,6.7262,6.7169,6.7073,6.7004,6.6893,6.6778,6.6675,6.6580,6.6496,6.6422,6.6337,6.6263,6.6196],
    },
    compression_ratio_curve: {
      mean: [0.6604,0.6604,0.6604,0.6604,0.6604,0.6609,0.6615,0.6620,0.6618,0.6606,0.6589,0.6571,0.6552,0.6525,0.6499,0.6478,0.6459,0.6447,0.6438,0.6429,0.6420,0.6428,0.6439,0.6452,0.6471,0.6474,0.6475,0.6475,0.6471,0.6468,0.6465,0.6465,0.6467,0.6488,0.6515,0.6544,0.6572,0.6598,0.6622,0.6650,0.6677,0.6700,0.6719,0.6734,0.6744,0.6756,0.6768,0.6776,0.6776,0.6776],
      std:  [0.0567,0.0567,0.0567,0.0567,0.0567,0.0570,0.0575,0.0584,0.0597,0.0603,0.0607,0.0612,0.0622,0.0625,0.0621,0.0612,0.0605,0.0601,0.0599,0.0598,0.0598,0.0598,0.0606,0.0616,0.0626,0.0606,0.0584,0.0566,0.0552,0.0541,0.0536,0.0535,0.0540,0.0540,0.0543,0.0549,0.0560,0.0569,0.0579,0.0588,0.0592,0.0590,0.0586,0.0583,0.0582,0.0584,0.0591,0.0599,0.0599,0.0599],
    },
    punctuation_ratio_curve: {
      mean: [0.0930,0.0930,0.0930,0.0930,0.0930,0.0934,0.0937,0.0941,0.0944,0.0943,0.0941,0.0939,0.0937,0.0934,0.0932,0.0930,0.0928,0.0928,0.0930,0.0932,0.0934,0.0934,0.0933,0.0931,0.0930,0.0928,0.0925,0.0923,0.0922,0.0921,0.0922,0.0922,0.0922,0.0921,0.0921,0.0922,0.0924,0.0929,0.0934,0.0941,0.0950,0.0957,0.0965,0.0973,0.0980,0.0981,0.0979,0.0978,0.0978,0.0978],
      std:  [0.0270,0.0270,0.0270,0.0270,0.0270,0.0271,0.0274,0.0277,0.0282,0.0281,0.0280,0.0280,0.0279,0.0278,0.0276,0.0274,0.0272,0.0271,0.0269,0.0267,0.0265,0.0263,0.0258,0.0253,0.0249,0.0246,0.0244,0.0242,0.0239,0.0236,0.0233,0.0230,0.0228,0.0226,0.0223,0.0219,0.0218,0.0217,0.0217,0.0219,0.0225,0.0231,0.0238,0.0246,0.0253,0.0253,0.0252,0.0251,0.0251,0.0251],
    },
    unique_ratio_curve: {
      mean: [0.5042,0.5042,0.5042,0.5042,0.5042,0.5036,0.5031,0.5025,0.5015,0.5007,0.4995,0.4982,0.4968,0.4956,0.4944,0.4934,0.4927,0.4911,0.4896,0.4880,0.4864,0.4863,0.4868,0.4876,0.4891,0.4903,0.4919,0.4937,0.4954,0.4976,0.4997,0.5021,0.5048,0.5086,0.5130,0.5180,0.5224,0.5262,0.5299,0.5335,0.5370,0.5398,0.5416,0.5430,0.5439,0.5445,0.5449,0.5452,0.5452,0.5452],
      std:  [0.0590,0.0590,0.0590,0.0590,0.0590,0.0591,0.0593,0.0596,0.0601,0.0595,0.0584,0.0575,0.0568,0.0564,0.0559,0.0555,0.0554,0.0543,0.0537,0.0541,0.0549,0.0553,0.0559,0.0567,0.0569,0.0575,0.0583,0.0591,0.0605,0.0617,0.0630,0.0642,0.0656,0.0672,0.0681,0.0684,0.0688,0.0697,0.0713,0.0732,0.0752,0.0762,0.0761,0.0759,0.0757,0.0754,0.0750,0.0748,0.0748,0.0748],
    },
  },
  aigc: {
    scalar: {
      final_entropy:          { mean: 6.6332, std: 0.7241 },
      local_entropy_mean:     { mean: 6.6051, std: 0.7760 },
      local_entropy_std:      { mean: 0.0318, std: 0.0762 },
      compression_ratio_zlib: { mean: 0.5675, std: 0.0446 },
      punctuation_ratio:      { mean: 0.0828, std: 0.0228 },
      avg_line_length:        { mean: 175.53, std: 126.34 },
      para_entropy:           { mean: 2.3511, std: 0.2719 },
      unique_ratio:           { mean: 0.3791, std: 0.1221 },
    },
    curve: {
      mean: [6.5564,6.5564,6.5564,6.5564,6.5562,6.5534,6.5504,6.5461,6.5385,6.5310,6.5235,6.5164,6.5099,6.5034,6.4975,6.4927,6.4889,6.4840,6.4799,6.4750,6.4670,6.4584,6.4509,6.4438,6.4377,6.4323,6.4270,6.4215,6.4154,6.4085,6.4010,6.3937,6.3867,6.3796,6.3725,6.3654,6.3592,6.3522,6.3440,6.3348,6.3269,6.3173,6.3071,6.2969,6.2875,6.2787,6.2705,6.2628,6.2563,6.2511],
      std:  [0.6430,0.6430,0.6430,0.6430,0.6430,0.6451,0.6471,0.6495,0.6526,0.6559,0.6588,0.6611,0.6628,0.6643,0.6656,0.6666,0.6671,0.6678,0.6681,0.6676,0.6667,0.6664,0.6663,0.6662,0.6661,0.6660,0.6660,0.6659,0.6659,0.6660,0.6663,0.6668,0.6674,0.6681,0.6689,0.6698,0.6709,0.6720,0.6734,0.6749,0.6760,0.6773,0.6788,0.6803,0.6817,0.6831,0.6844,0.6855,0.6864,0.6872],
      q25:  [6.1291,6.1291,6.1291,6.1291,6.1285,6.1216,6.1139,6.1045,6.0911,6.0780,6.0658,6.0550,6.0461,6.0374,6.0300,6.0238,6.0189,6.0125,6.0069,6.0019,5.9940,5.9842,5.9748,5.9656,5.9572,5.9506,5.9446,5.9380,5.9307,5.9225,5.9140,5.9057,5.8978,5.8899,5.8820,5.8735,5.8655,5.8574,5.8477,5.8362,5.8259,5.8129,5.7992,5.7858,5.7730,5.7605,5.7485,5.7369,5.7268,5.7195],
      q75:  [6.9580,6.9580,6.9580,6.9580,6.9580,6.9574,6.9570,6.9556,6.9533,6.9517,6.9505,6.9494,6.9482,6.9470,6.9459,6.9451,6.9443,6.9438,6.9433,6.9418,6.9379,6.9329,6.9284,6.9246,6.9217,6.9194,6.9173,6.9147,6.9116,6.9073,6.9020,6.8967,6.8912,6.8852,6.8786,6.8716,6.8655,6.8594,6.8526,6.8452,6.8397,6.8338,6.8281,6.8227,6.8177,6.8128,6.8080,6.8030,6.7984,6.7945],
    },
    compression_ratio_curve: {
      mean: [0.6554,0.6554,0.6554,0.6554,0.6543,0.6519,0.6496,0.6472,0.6473,0.6464,0.6454,0.6441,0.6426,0.6407,0.6389,0.6378,0.6363,0.6356,0.6345,0.6324,0.6295,0.6268,0.6245,0.6223,0.6201,0.6179,0.6156,0.6132,0.6109,0.6078,0.6047,0.6024,0.6018,0.6018,0.6025,0.6043,0.6058,0.6079,0.6102,0.6122,0.6139,0.6152,0.6167,0.6190,0.6210,0.6224,0.6228,0.6228,0.6228,0.6228],
      std:  [0.0775,0.0775,0.0775,0.0775,0.0748,0.0702,0.0668,0.0649,0.0649,0.0617,0.0587,0.0556,0.0527,0.0500,0.0477,0.0462,0.0452,0.0454,0.0457,0.0456,0.0452,0.0447,0.0449,0.0454,0.0461,0.0464,0.0464,0.0464,0.0466,0.0455,0.0447,0.0438,0.0431,0.0432,0.0436,0.0439,0.0442,0.0449,0.0462,0.0479,0.0497,0.0511,0.0533,0.0555,0.0576,0.0594,0.0597,0.0597,0.0597,0.0597],
    },
    punctuation_ratio_curve: {
      mean: [0.0870,0.0870,0.0870,0.0870,0.0868,0.0864,0.0859,0.0855,0.0854,0.0852,0.0850,0.0848,0.0848,0.0848,0.0847,0.0848,0.0848,0.0848,0.0847,0.0845,0.0842,0.0839,0.0840,0.0841,0.0841,0.0841,0.0840,0.0838,0.0837,0.0832,0.0826,0.0820,0.0816,0.0814,0.0812,0.0811,0.0809,0.0806,0.0804,0.0801,0.0800,0.0799,0.0799,0.0800,0.0801,0.0802,0.0803,0.0803,0.0803,0.0803],
      std:  [0.0201,0.0201,0.0201,0.0201,0.0204,0.0212,0.0220,0.0230,0.0234,0.0238,0.0244,0.0246,0.0246,0.0247,0.0247,0.0245,0.0243,0.0239,0.0239,0.0242,0.0244,0.0247,0.0241,0.0235,0.0230,0.0228,0.0228,0.0228,0.0228,0.0236,0.0245,0.0254,0.0259,0.0261,0.0261,0.0261,0.0264,0.0268,0.0271,0.0274,0.0276,0.0277,0.0277,0.0275,0.0271,0.0269,0.0268,0.0268,0.0268,0.0268],
    },
    unique_ratio_curve: {
      mean: [0.4597,0.4597,0.4597,0.4597,0.4587,0.4569,0.4550,0.4532,0.4531,0.4524,0.4516,0.4508,0.4500,0.4489,0.4478,0.4471,0.4461,0.4457,0.4450,0.4440,0.4422,0.4408,0.4394,0.4381,0.4367,0.4355,0.4343,0.4330,0.4318,0.4303,0.4288,0.4283,0.4292,0.4303,0.4318,0.4340,0.4361,0.4391,0.4422,0.4452,0.4479,0.4494,0.4510,0.4523,0.4531,0.4537,0.4537,0.4537,0.4537,0.4537],
      std:  [0.0948,0.0948,0.0948,0.0948,0.0969,0.1015,0.1065,0.1118,0.1121,0.1138,0.1156,0.1175,0.1197,0.1219,0.1242,0.1255,0.1266,0.1260,0.1254,0.1248,0.1239,0.1232,0.1225,0.1218,0.1213,0.1209,0.1206,0.1204,0.1203,0.1208,0.1215,0.1224,0.1236,0.1253,0.1273,0.1294,0.1309,0.1321,0.1335,0.1353,0.1369,0.1353,0.1333,0.1312,0.1292,0.1279,0.1278,0.1278,0.1278,0.1278],
    },
  },
};

var RADAR_FEATS = ['final_entropy','compression_ratio_zlib','punctuation_ratio','avg_line_length','unique_ratio','para_entropy'];

// 2. Analysis functions

function shannonEntropy(text) {
  if (!text) return 0;
  var len = text.length;
  var freq = {};
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    freq[ch] = (freq[ch] || 0) + 1;
  }
  var H = 0;
  for (var ch in freq) {
    var p = freq[ch] / len;
    H -= p * Math.log2(p);
  }
  return H;
}

function localEntropyCurve(text, windowSize, stride) {
  windowSize = windowSize || 300;
  stride = stride || 150;
  var L = text.length;
  var rows = [];
  var start = 0, idx = 0;
  while (start < L) {
    var end = Math.min(start + windowSize, L);
    var chunk = text.slice(start, end);
    var e = shannonEntropy(chunk);
    rows.push({ pos: (start + end) / 2 / L, entropy: e, idx: idx });
    if (end >= L) break;
    start += stride;
    idx++;
  }
  return rows;
}

function localPunctuationCurve(text, windowSize, stride) {
  windowSize = windowSize || 300;
  stride = stride || 150;
  var L = text.length;
  var rows = [];
  var start = 0;
  while (start < L) {
    var end = Math.min(start + windowSize, L);
    var chunk = text.slice(start, end);
    var punc = 0;
    for (var i = 0; i < chunk.length; i++) {
      var ch = chunk[i];
      if (!/[a-zA-Z0-9一-鿿]/.test(ch) && !/\s/.test(ch)) punc++;
    }
    rows.push({ pos: (start + end) / 2 / L, value: punc / chunk.length });
    if (end >= L) break;
    start += stride;
  }
  return rows;
}

function localUniqueCurve(text, windowSize, stride) {
  windowSize = windowSize || 300;
  stride = stride || 150;
  var L = text.length;
  var rows = [];
  var start = 0;
  while (start < L) {
    var end = Math.min(start + windowSize, L);
    var chunk = text.slice(start, end);
    var s = new Set(chunk);
    rows.push({ pos: (start + end) / 2 / L, value: s.size / chunk.length });
    if (end >= L) break;
    start += stride;
  }
  return rows;
}

async function localCompressionCurve(text, windowSize, stride) {
  windowSize = windowSize || 300;
  stride = stride || 150;
  var L = text.length;
  var rows = [];
  var start = 0;
  while (start < L) {
    var end = Math.min(start + windowSize, L);
    var chunk = text.slice(start, end);
    var ratio = chunk.length > 10 ? await compressionRatio(chunk) : 1;
    rows.push({ pos: (start + end) / 2 / L, value: ratio });
    if (end >= L) break;
    start += stride;
  }
  return rows;
}

async function compressionRatio(text) {
  if (!text) return 1;
  try {
    var encoder = new TextEncoder();
    var bytes = encoder.encode(text);
    var cs = new CompressionStream('gzip');
    var writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    var reader = cs.readable.getReader();
    var chunks = [];
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      chunks.push(r.value);
    }
    var total = 0;
    for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
    return total / bytes.length;
  } catch (e) {
    return -1;
  }
}

function extractScalarFeatures(text) {
  if (!text) return null;
  var L = text.length;
  var lines = text.split('\n');
  var nonEmpty = [];
  for (var i = 0; i < lines.length; i++) { if (lines[i].trim()) nonEmpty.push(lines[i]); }
  var paras = text.split(/\n\n+/).filter(function(p) { return p.trim(); });

  var final_entropy = shannonEntropy(text);

  var curve = localEntropyCurve(text, Math.min(600, L), Math.max(1, Math.min(300, Math.floor(L/2))));
  var localVals = curve.map(function(r) { return r.entropy; });
  var local_entropy_mean = localVals.reduce(function(a,b){return a+b},0) / localVals.length;
  var local_entropy_std = Math.sqrt(localVals.reduce(function(s,v){return s+(v-local_entropy_mean)*(v-local_entropy_mean)},0) / localVals.length);

  var punc = 0;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (!/[a-zA-Z0-9一-鿿]/.test(ch) && !/\s/.test(ch)) punc++;
  }
  var punctuation_ratio = punc / L;

  var totalLen = 0;
  for (var i = 0; i < nonEmpty.length; i++) totalLen += nonEmpty[i].length;
  var avg_line_length = nonEmpty.length ? totalLen / nonEmpty.length : 0;

  var paraLens = paras.map(function(p) { return p.length; });
  var para_entropy = paraLens.length ? shannonEntropy(paraLens.join(' ')) : 0;

  var s = new Set(text);
  var unique_ratio = s.size / L;

  return {
    final_entropy: final_entropy,
    local_entropy_mean: local_entropy_mean,
    local_entropy_std: local_entropy_std,
    derivative_energy: 0,
    punctuation_ratio: punctuation_ratio,
    avg_line_length: avg_line_length,
    para_entropy: para_entropy,
    unique_ratio: unique_ratio,
    char_count: L,
  };
}

function zScore(val, mean, std) {
  return std > 1e-8 ? (val - mean) / std : 0;
}

function profileDistance(feats, profile) {
  var names = ['final_entropy','local_entropy_mean','local_entropy_std','compression_ratio_zlib',
               'punctuation_ratio','avg_line_length','para_entropy','unique_ratio'];
  var zs = {};
  var totalAbs = 0, n = 0;
  for (var i = 0; i < names.length; i++) {
    var f = names[i];
    if (feats[f] === undefined) continue;
    var p = profile.scalar[f];
    if (!p) continue;
    var z = zScore(feats[f], p.mean, p.std);
    zs[f+'_z'] = z;
    totalAbs += Math.abs(z);
    n++;
  }
  return { mean_abs_z: n ? totalAbs / n : Infinity, zs: zs };
}

// 3. D3 chart rendering for blog

var BMARGIN = { top: 16, right: 22, bottom: 28, left: 42 };

function renderBlogEntropyCurve(inputCurve) {
  var container = document.getElementById('blogEntropyChart');
  if (!container) return;
  container.innerHTML = '';
  var W = container.clientWidth || 600;
  var H = 280;
  var w = W - BMARGIN.left - BMARGIN.right;
  var h = H - BMARGIN.top - BMARGIN.bottom;

  var svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  var g = svg.append('g').attr('transform', 'translate(' + BMARGIN.left + ',' + BMARGIN.top + ')');

  var xScale = d3.scaleLinear().domain([0, 1]).range([0, w]);
  var yDomain = [3, 8.5];
  var yScale = d3.scaleLinear().domain(yDomain).range([h, 0]);

  var xGrid = d3.range(0, 1.001, 0.001);
  ['human','aigc'].forEach(function(grp) {
    var c = REF[grp].curve;
    var interpMean = d3.scaleLinear().domain(d3.range(0,1.001,1/(c.mean.length-1))).range(c.mean);
    var interpStd  = d3.scaleLinear().domain(d3.range(0,1.001,1/(c.std.length-1))).range(c.std);
    var interpQ25 = d3.scaleLinear().domain(d3.range(0,1.001,1/(c.q25.length-1))).range(c.q25);
    var interpQ75 = d3.scaleLinear().domain(d3.range(0,1.001,1/(c.q75.length-1))).range(c.q75);
    var color = grp === 'human' ? '#2e86ab' : '#ca562c';

    g.append('path').datum(xGrid.map(function(x) { return {x:x, y:interpMean(x)}; }))
      .attr('fill','none').attr('stroke',color).attr('stroke-width',1.5)
      .attr('stroke-dasharray', grp==='human'?'':'4,3')
      .attr('d', d3.line().x(function(d){return xScale(d.x)}).y(function(d){return yScale(d.y)}));

    g.append('path').datum(xGrid.map(function(x) { return {x:x, y0:interpQ25(x), y1:interpQ75(x)}; }))
      .attr('fill',color).attr('opacity',0.1)
      .attr('d', d3.area().x(function(d){return xScale(d.x)}).y0(function(d){return yScale(d.y0)}).y1(function(d){return yScale(d.y1)}));

    g.append('text').attr('x', w+2).attr('y', yScale(interpMean(1)))
      .attr('fill',color).attr('font-size',10).attr('dy','0.32em')
      .text(grp==='human'?'Human':'AIGC');
  });

  if (inputCurve && inputCurve.length > 1) {
    var line = d3.line().x(function(d){return xScale(d.pos)}).y(function(d){return yScale(d.entropy)}).curve(d3.curveMonotoneX);
    g.append('path').datum(inputCurve).attr('fill','none').attr('stroke','#111').attr('stroke-width',2.5).attr('d', line);

    var tip = document.getElementById('blogAnalysisTooltip');
    g.selectAll('.bd').data(inputCurve).enter().append('circle')
      .attr('cx', function(d){return xScale(d.pos)}).attr('cy', function(d){return yScale(d.entropy)})
      .attr('r', 6).attr('fill','transparent')
      .on('mouseover', function(ev, d) {
        tip.textContent = 'pos=' + d.pos.toFixed(3) + '  H=' + d.entropy.toFixed(3);
        tip.classList.add('show');
      })
      .on('mousemove', function(ev) {
        var r = container.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left + 12) + 'px';
        tip.style.top = (ev.clientY - r.top - 28) + 'px';
      })
      .on('mouseout', function() { tip.classList.remove('show'); });
  }

  g.append('g').attr('transform','translate(0,'+h+')').call(d3.axisBottom(xScale).ticks(6));
  g.append('g').call(d3.axisLeft(yScale).ticks(5));
}

function renderBlogMetricCurve(containerId, data, refHuman, refAigc, opts) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  var W = container.clientWidth || 300;
  var H = opts.height || 230;
  var w = W - BMARGIN.left - BMARGIN.right;
  var h = H - BMARGIN.top - BMARGIN.bottom;

  var svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  var g = svg.append('g').attr('transform', 'translate(' + BMARGIN.left + ',' + BMARGIN.top + ')');

  var xScale = d3.scaleLinear().domain([0, 1]).range([0, w]);

  var yMin = Infinity, yMax = -Infinity;
  [refHuman, refAigc].forEach(function(ref) {
    if (ref && ref.mean) {
      var n = ref.mean.length;
      var interpMean = d3.scaleLinear().domain(d3.range(0,1.001,1/(n-1))).range(ref.mean);
      var interpStd  = d3.scaleLinear().domain(d3.range(0,1.001,1/(n-1))).range(ref.std);
      for (var i = 0; i <= 100; i++) {
        var x = i / 100;
        var m = interpMean(x);
        var s = interpStd(x) * 3;
        yMin = Math.min(yMin, m - s);
        yMax = Math.max(yMax, m + s);
      }
    }
  });
  if (data && data.length) {
    for (var i = 0; i < data.length; i++) {
      yMin = Math.min(yMin, data[i].value);
      yMax = Math.max(yMax, data[i].value);
    }
  }
  var yPad = (yMax - yMin) * 0.1 || 0.5;
  var yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([h, 0]);

  [['human', refHuman], ['aigc', refAigc]].forEach(function(pair) {
    var grp = pair[0], ref = pair[1];
    if (!ref || !ref.mean) return;
    var n = ref.mean.length;
    var interpMean = d3.scaleLinear().domain(d3.range(0,1.001,1/(n-1))).range(ref.mean);
    var interpStd  = d3.scaleLinear().domain(d3.range(0,1.001,1/(n-1))).range(ref.std);
    var color = grp === 'human' ? '#2e86ab' : '#ca562c';

    g.append('path').datum(d3.range(0,1.001,1/(n-1)).map(function(x) {
      return {x:x, y0:interpMean(x)-3*interpStd(x), y1:interpMean(x)+3*interpStd(x)};
    })).attr('fill',color).attr('opacity',0.08)
      .attr('d', d3.area().x(function(d){return xScale(d.x)}).y0(function(d){return yScale(d.y0)}).y1(function(d){return yScale(d.y1)}));

    g.append('path').datum(d3.range(0,1.001,1/(n-1)).map(function(x) {
      return {x:x, y:interpMean(x)};
    })).attr('fill','none').attr('stroke',color).attr('stroke-width',1.5)
      .attr('stroke-dasharray',grp==='human'?'':'4,3')
      .attr('d', d3.line().x(function(d){return xScale(d.x)}).y(function(d){return yScale(d.y)}));

    g.append('text').attr('x', w+2).attr('y', yScale(interpMean(1)))
      .attr('fill',color).attr('font-size',9).attr('dy','0.32em')
      .text(grp==='human'?'Human':'AIGC');
  });

  if (data && data.length > 1) {
    var line = d3.line().x(function(d){return xScale(d.pos)}).y(function(d){return yScale(d.value)}).curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('fill','none').attr('stroke','#111').attr('stroke-width',2).attr('d', line);

    var tip = document.getElementById('blogAnalysisTooltip');
    g.selectAll('.bhv').data(data).enter().append('circle')
      .attr('cx', function(d){return xScale(d.pos)}).attr('cy', function(d){return yScale(d.value)})
      .attr('r', 6).attr('fill','transparent')
      .on('mouseover', function(ev, d) {
        tip.textContent = 'pos=' + d.pos.toFixed(3) + '  ' + opts.yLabel + '=' + ((opts.fmt||function(v){return v.toFixed(3)})(d.value));
        tip.classList.add('show');
      })
      .on('mousemove', function(ev) {
        var r = container.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left + 12) + 'px';
        tip.style.top = (ev.clientY - r.top - 28) + 'px';
      })
      .on('mouseout', function() { tip.classList.remove('show'); });
  }

  g.append('g').attr('transform','translate(0,'+h+')').call(d3.axisBottom(xScale).ticks(5));
  g.append('g').call(d3.axisLeft(yScale).ticks(4));
}

function renderBlogRadar(feats) {
  var container = document.getElementById('blogRadarChart');
  if (!container) return;
  container.innerHTML = '';
  var W = Math.min(container.clientWidth || 340, 400);
  var H = 280;
  var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;

  var svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  var g = svg.append('g').attr('transform', 'translate(' + cx + ',' + cy + ')');

  var allVals = {};
  ['human','aigc'].forEach(function(grp) {
    RADAR_FEATS.forEach(function(f) {
      var s = REF[grp].scalar[f];
      if (!allVals[f]) allVals[f] = [];
      allVals[f].push(s.mean - 2*s.std, s.mean + 2*s.std);
    });
  });
  if (feats) {
    RADAR_FEATS.forEach(function(f) {
      if (feats[f] !== undefined) allVals[f].push(feats[f]);
    });
  }
  var gmin = {}, gmax = {};
  RADAR_FEATS.forEach(function(f) {
    gmin[f] = Math.min.apply(null, allVals[f]);
    gmax[f] = Math.max.apply(null, allVals[f]);
  });
  function norm(val, f) { return (val - gmin[f]) / Math.max(gmax[f] - gmin[f], 1e-8); }

  var nFeats = RADAR_FEATS.length;
  var angle = d3.scaleLinear().domain([0, nFeats]).range([0, 2*Math.PI]);
  var rScale = d3.scaleLinear().domain([0, 1]).range([0, R]);

  for (var lv = 0.25; lv <= 1; lv += 0.25) {
    g.append('circle').attr('r', rScale(lv)).attr('fill','none').attr('stroke','#ddd').attr('stroke-width',0.5);
  }

  for (var i = 0; i < nFeats; i++) {
    var a = angle(i) - Math.PI/2;
    var x = rScale(1) * Math.cos(a);
    var y = rScale(1) * Math.sin(a);
    g.append('line').attr('x1',0).attr('y1',0).attr('x2',x).attr('y2',y).attr('stroke','#ddd').attr('stroke-width',0.5);
    var lx = rScale(1.08) * Math.cos(a);
    var ly = rScale(1.08) * Math.sin(a);
    g.append('text').attr('x', lx).attr('y', ly).attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('font-size','8').attr('fill','#555').text(RADAR_FEATS[i].replace(/_/g,' '));
  }

  function radarPath(ref, key) {
    var pts = [];
    for (var i = 0; i < nFeats; i++) {
      var f = RADAR_FEATS[i];
      var val = key === 'input' ? ref[f] : ref[key][f].mean;
      var v = norm(val, f);
      var a = angle(i) - Math.PI/2;
      pts.push([rScale(v) * Math.cos(a), rScale(v) * Math.sin(a)]);
    }
    return pts.map(function(p, i) { return (i===0?'M':'L') + p[0] + ',' + p[1]; }).join(' ') + 'Z';
  }

  g.append('path').attr('d', radarPath(REF.human, 'scalar')).attr('fill','#2e86ab').attr('opacity',0.15).attr('stroke','#2e86ab').attr('stroke-width',1.5).attr('stroke-dasharray','3,2');
  g.append('path').attr('d', radarPath(REF.aigc, 'scalar')).attr('fill','#ca562c').attr('opacity',0.15).attr('stroke','#ca562c').attr('stroke-width',1.5).attr('stroke-dasharray','3,2');

  if (feats) {
    g.append('path').attr('d', radarPath(feats, 'input')).attr('fill','none').attr('stroke','#111').attr('stroke-width',2);
    for (var i = 0; i < nFeats; i++) {
      var f = RADAR_FEATS[i];
      if (feats[f] === undefined) continue;
      var v = norm(feats[f], f);
      var a = angle(i) - Math.PI/2;
      g.append('circle').attr('cx', rScale(v) * Math.cos(a)).attr('cy', rScale(v) * Math.sin(a)).attr('r', 4).attr('fill','#111');
    }
  }

  var leg = svg.append('g').attr('transform', 'translate(10, ' + (H-40) + ')');
  [['Human','#2e86ab'],['AIGC','#ca562c'],['本文','#111']].forEach(function(item, i) {
    leg.append('rect').attr('x', i*80).attr('y', 0).attr('width',10).attr('height',10).attr('fill', item[1]).attr('opacity',0.7);
    leg.append('text').attr('x', i*80+14).attr('y', 9).attr('font-size','9').attr('fill','#555').text(item[0]);
  });
}

// 4. Metrics

function renderBlogMetrics(feats, distH, distA) {
  var container = document.getElementById('analysisMetrics');
  if (!container) return;
  container.innerHTML = '';

  var items = [
    { label: '最终熵', val: feats.final_entropy.toFixed(3), sub: 'z(H)=' + distH.zs.final_entropy_z.toFixed(2) + '  z(A)=' + distA.zs.final_entropy_z.toFixed(2) },
    { label: '压缩比', val: feats.compression_ratio_zlib !== undefined && feats.compression_ratio_zlib > 0 ? feats.compression_ratio_zlib.toFixed(3) : 'N/A',
      sub: feats.compression_ratio_zlib > 0 ? 'z(H)=' + (distH.zs.compression_ratio_zlib_z||0).toFixed(2) + '  z(A)=' + (distA.zs.compression_ratio_zlib_z||0).toFixed(2) : '' },
    { label: '标点率', val: feats.punctuation_ratio.toFixed(3), sub: 'z(H)=' + distH.zs.punctuation_ratio_z.toFixed(2) + '  z(A)=' + distA.zs.punctuation_ratio_z.toFixed(2) },
    { label: '独特字符比', val: feats.unique_ratio.toFixed(3), sub: 'z(H)=' + distH.zs.unique_ratio_z.toFixed(2) + '  z(A)=' + distA.zs.unique_ratio_z.toFixed(2) },
  ];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var card = document.createElement('div');
    card.className = 'analysis-card';
    card.innerHTML = '<span class="label">' + item.label + '</span><span class="value">' + item.val + '</span><span class="sub">' + item.sub + '</span>';
    container.appendChild(card);
  }
}

// 5. Main entry point

async function analyzeArticle(htmlContent) {
  var metricsEl = document.getElementById('analysisMetrics');
  var chartsEl = document.getElementById('analysisCharts');
  if (!metricsEl) return;

  // Show loading
  metricsEl.innerHTML = '<div class="analysis-empty">分析中...</div>';
  if (chartsEl) chartsEl.style.display = 'none';

  // Convert HTML to plain text
  var div = document.createElement('div');
  div.innerHTML = htmlContent || '';
  var remove = div.querySelectorAll('pre, code, script, style');
  for (var i = 0; i < remove.length; i++) remove[i].remove();
  var text = (div.textContent || '').trim();

  if (!text || text.length < 50) {
    metricsEl.innerHTML = '<div class="analysis-empty">文章过短（< 50 字符），无法分析</div>';
    return;
  }

  try {
    var feats = extractScalarFeatures(text);
    if (!feats) { metricsEl.innerHTML = '<div class="analysis-empty">无法提取特征</div>'; return; }

    feats.compression_ratio_zlib = await compressionRatio(text);

    var distH = profileDistance(feats, REF.human);
    var distA = profileDistance(feats, REF.aigc);

    var entCurve = localEntropyCurve(text);
    var puncCurve = localPunctuationCurve(text);
    var uniqCurve = localUniqueCurve(text);
    var compCurve = await localCompressionCurve(text);

    renderBlogMetrics(feats, distH, distA);

    renderBlogEntropyCurve(entCurve);
    renderBlogMetricCurve('blogCompCurve', compCurve, REF.human.compression_ratio_curve, REF.aigc.compression_ratio_curve, { yLabel: 'Comp ratio', height: 220 });
    renderBlogMetricCurve('blogPuncCurve', puncCurve, REF.human.punctuation_ratio_curve, REF.aigc.punctuation_ratio_curve, { yLabel: 'Punc ratio', height: 220 });
    renderBlogMetricCurve('blogUniqCurve', uniqCurve, REF.human.unique_ratio_curve, REF.aigc.unique_ratio_curve, { yLabel: 'Unique ratio', height: 220 });
    renderBlogRadar(feats);

    if (chartsEl) chartsEl.style.display = '';
  } catch (err) {
    metricsEl.innerHTML = '<div class="analysis-empty">分析出错: ' + err.message + '</div>';
  }
}
