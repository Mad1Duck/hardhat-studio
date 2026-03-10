import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-BIZn5CXJ.js";
import { _ as __name } from "./index-C5W5dauG.js";
import "./chunk-FMBD7UC4-C3w1zQ3G.js";
import "./chunk-55IACEB6-BHKGm1Eg.js";
import "./chunk-QN33PNHL-DoFi1gHz.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
