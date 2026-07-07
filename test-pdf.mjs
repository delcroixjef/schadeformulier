import { generateAttestPdf } from './src/lib/generate-attest';
import { writeFileSync } from 'fs';
// tiny 1x1 png signature
const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAOklEQVR4nO3PAQ0AAAjDMK5/aeDhBmXQmXZFRBhh1LRDaGgLwaB9EAaCQfsgDASD9kEYCAbtgzD4AwAA//9YrgFO3xkFxAAAAABJRU5ErkJggg==';
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
