"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = __importDefault(require("crypto"));
var fs_1 = __importDefault(require("fs"));
var papaparse_1 = __importDefault(require("papaparse"));
var zod_1 = require("zod");
var db_1 = require("../db");
var schema_1 = require("../db/schema");
var semantic_matcher_1 = require("../lib/ai/semantic-matcher");
var BATCH_SIZE = 100; // Agrupa inserciones para mejorar performance de IO
// Validador Zod robusto con coerción monetaria y de fechas
var SaleRowSchema = zod_1.z.object({
    date: zod_1.z.string().transform(function (v) {
        var d = new Date(v);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }),
    shift: zod_1.z.string().catch("GENERAL"),
    raw_name: zod_1.z.string(),
    quantity: zod_1.z.coerce.number().catch(1),
    price: zod_1.z
        .string()
        .transform(function (v) {
        // Transformar "$12.00", "12,00" o "1200" a centavos "1200"
        var numeric = v.replace(/[^0-9.-]+/g, "");
        return Math.round(Number.parseFloat(numeric) * 100) || 0;
    })
        .catch(0),
});
function runETL() {
    return __awaiter(this, void 0, void 0, function () {
        var filePath, fileContent, parsedData, rawBatch, totalProcessed, _i, _a, record, rawRow, parsed, hashContext, idHash, currentBatch, err_1, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    filePath = process.argv[2] || "ventas_2026_crudo.csv";
                    if (!fs_1.default.existsSync(filePath)) {
                        console.error("Uso o archivo no encontrado: ".concat(filePath));
                        process.exit(1);
                    }
                    fileContent = fs_1.default.readFileSync(filePath, "utf-8");
                    parsedData = papaparse_1.default.parse(fileContent, {
                        header: true,
                        skipEmptyLines: true,
                    });
                    rawBatch = [];
                    totalProcessed = 0;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 11, , 12]);
                    console.log("\uD83D\uDE80 Iniciando Ingesta Zero-Trust Stream-Based: ".concat(filePath));
                    _i = 0, _a = parsedData.data;
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    record = _a[_i];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 6, , 7]);
                    rawRow = {
                        date: record.fecha || record.date || record.Fecha || new Date().toISOString(),
                        shift: record.turno || record.shift || record.Turno || "GENERAL",
                        raw_name: record.producto || record.name || record.Producto || record.Item || "DESCONOCIDO",
                        quantity: record.cantidad || record.qty || record.Cantidad || "1",
                        price: record.total || record.price || record.Total || record.Precio || "0",
                    };
                    parsed = SaleRowSchema.parse(rawRow);
                    hashContext = "".concat(parsed.date, "|").concat(parsed.shift, "|").concat(parsed.raw_name);
                    idHash = crypto_1.default.createHash("sha256").update(hashContext).digest("hex");
                    rawBatch.push({
                        id: idHash,
                        date: parsed.date,
                        shift: parsed.shift,
                        raw_name: parsed.raw_name,
                        quantity: parsed.quantity,
                        net_price_cents: parsed.price,
                    });
                    if (!(rawBatch.length >= BATCH_SIZE)) return [3 /*break*/, 5];
                    currentBatch = __spreadArray([], rawBatch, true);
                    rawBatch = [];
                    return [4 /*yield*/, processAndInsertBatch(currentBatch)];
                case 4:
                    _b.sent();
                    totalProcessed += currentBatch.length;
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_1 = _b.sent();
                    console.error("\u26A0\uFE0F Error parseando fila: ".concat(err_1.message));
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8:
                    if (!(rawBatch.length > 0)) return [3 /*break*/, 10];
                    return [4 /*yield*/, processAndInsertBatch(rawBatch)];
                case 9:
                    _b.sent();
                    totalProcessed += rawBatch.length;
                    _b.label = 10;
                case 10:
                    console.log("\u2705 ETL Finalizado con Zero Errores. Filas Puras Procesadas: ".concat(totalProcessed));
                    process.exit(0);
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _b.sent();
                    console.error("❌ Error Crítico en Pipeline ETL:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function processAndInsertBatch(rawItems) {
    return __awaiter(this, void 0, void 0, function () {
        var semanticTasks, enrichedBatch, err_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    semanticTasks = rawItems.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                        var productSku;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, semantic_matcher_1.normalizeProductSKU)(item.raw_name)];
                                case 1:
                                    productSku = _a.sent();
                                    return [2 /*return*/, __assign(__assign({}, item), { productSku: productSku })];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(semanticTasks)];
                case 1:
                    enrichedBatch = _a.sent();
                    // Inserción atómica idempotente
                    return [4 /*yield*/, db_1.db.insert(schema_1.fact_sales).values(enrichedBatch).onConflictDoNothing()];
                case 2:
                    // Inserción atómica idempotente
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    console.error("❌ Fallo procesando o insertando batch:", err_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
runETL();
