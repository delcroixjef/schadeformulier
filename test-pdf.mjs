console.log('start');
const { generateAttestPdf } = await import('./src/lib/generate-attest.ts');
console.log('imported');
const { writeFileSync } = await import('fs');
const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const pdf = await generateAttestPdf({
  code:'ABC-123', naam:'Jan Janssens', email:'jan@example.com', telefoon:'0470123456',
  typeSchade:'auto', typeSchadeAndere:null, datumSchade:'07-07-2026',
  btwPlichtig:'ja', btwRecuperatie:'gedeeltelijk', btwPercentage:50,
  iban:'BE68539007547034', betaalwijze:'Op IBAN nr',
  bestuurderNaam:'Piet Peeters', bestuurderGeboortedatum:'01-01-1980',
  akkoordJuistheid:true, akkoordGdpr:true, handtekening: sig,
});
writeFileSync('/tmp/attest.pdf', pdf);
console.log('wrote', pdf.length);
process.exit(0);
