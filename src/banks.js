// Match only institutions explicitly identifiable in the source bank name.
export function bankBrand(location){
 if(location.type==='kpw')return {slug:'bank-indonesia',name:'Bank Indonesia'};
 const bank=(location.bank||'').toLowerCase();
 const tests=[
 [/syariah indonesia|\bbsi\b/,'bsi','Bank Syariah Indonesia'],
 [/rakyat indonesia|rakyta indonesia|rankyat indonesia|\bbri\b/,'bri','Bank Rakyat Indonesia'],
 [/negara indonesia|\bbni\b/,'bni','Bank Negara Indonesia'],
 [/mandiri/,'mandiri','Bank Mandiri'],
 [/kaltim|kaltara/,'bank-pembangunan-daerah-kaltim-dan-kaltara','Bank Kaltimtara'],
 [/kalbar/,'bank-bpd-kalbar','Bank Kalbar'],
 [/kalsel/,'bank-bpd-kalsel','Bank Kalsel'],
 [/kalteng/,'bank-bpd-kalteng','Bank Kalteng'],
 [/maluku|malut/,'bank-bpd-maluku-malut','Bank Maluku Malut'],
 [/ntb/,'bank-bpd-ntb-syariah','Bank NTB Syariah'],
 [/\bntt\b/,'bank-bpd-ntt','Bank NTT'],
 [/papua/,'bank-bpd-papua','Bank Papua'],
 [/brks|riau kepri syariah/,'bank-bpd-riau-kepri-syariah','Bank Riau Kepri Syariah'],
 [/sulsel|sulawesi selatan dan sulawesi barat/,'bank-bpd-sulselbar','Bank Sulselbar'],
 [/sulut/,'bank-bpd-sulutgo','Bank SulutGo'],
 [/sumatera selatan dan bangka belitung/,'bank-bpd-sumsel-babel','Bank Sumsel Babel']];
 const match=tests.find(([pattern])=>pattern.test(bank));return match?{slug:match[1],name:match[2]}:null;
}
export function bankLogo(location){const brand=bankBrand(location);return brand?`<img class="bank-logo" src="/bank-logos/${brand.slug}.svg" alt="Logo ${brand.name}" draggable="false" loading="eager">`:'<span class="bank-logo-fallback" title="Bank pengelola belum dapat dipastikan"><span></span><span></span><span></span></span>';}
