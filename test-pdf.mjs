console.log('start');
const { generateAttestPdf } = await import('./src/lib/generate-attest.ts');
console.log('imported');
const { writeFileSync } = await import('fs');
const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAABkCAYAAAA8AQ3AAAAEN0lEQVR4nO3dy3abShBAUXFX/v+XuSOWbCwQSP2o6t57kkHsGLXESTVRxLKu6wMgg/96HwDAVYIFpCFYQBqCBaQhWEAaggWkIVhAGoIFpCFYQBqCBaQhWEAaggWkIVhAGoIFpCFYQBqCBaQhWEAaggWkMVWwlmVZf/4K5LLM8pnuryK1ruvS41iAz0w1Ye2ZtCCXKYIlTDCG4YP1LlZiBnkMH6y9V9etRAtyGDpY+xBtsRItyGnYYL0LkGhBPsMGa+9VoLytAXIZMlhHW8FX9r9nyoK4hgtWieCI1nf8jwJqGe6d7nemq7Pvu/O9PB1FylpSwlAT1qexOvpaE8I9Z+tlLSlhmGCVOCFMAZ9ZlmW9sv5Xvw6ODLMl/Ga6qvlnje7dVvosUNaVu4aYsGoHxlTw2pXrfuu6LkfPh3XlrvQTVq2L5S7Cn/t0fVyU5xvDBavkC1+0/ioRHNtEPpU6WC2uNbme9VQ64KYt7kobrJbTj2jVXW/h4qohLro/Hm1f3LNdLK79l8PZRfnZ1no0pZ+/lBNWj4lnxutZPSYf01Zutc+TdMHqGY6ZotX7sQpXDlcmKMH6ofULuPfPb6F3rM6OYzPiumfQOlB/fn6mYEWJRZTjqCFKrH4ybfXTO1B7aYIV6USKdCylZIhChmPMLlqg9tIGq/eLdKRoZXostollRQ/UXopgRYvVJtOJfiTrYzBtfSZboPbCByv6CRU1pldEX9srhOtc9kDtpQtWxMXNcIw/jXaS2yY+jRaovdDByhKCTJNKpmO9a7QQXzF6oPbCBivbiZXheDMcYwkjh2u2QO2lCVaGJyFyECIfWw2jbBNnD9ReyGBljNUm2rGPPG1cke3xC9S5cMEaYRKIEq0R1rKUqOESqHvCByvjkxUhFBGOIZoI20SB+k6oYI0Qq41PlYir5bQlUGWFCdaIJ1nrxxR12xNVjfUSqLrCBmuUJ7XV4xox+C18u00UqLZCBGvUWG163DdxtDWs7eq0JVB9dQ/WDCdb6xs4jLZ+LX3yGeTWu51wwRr1yXeLrDzeRcsa99M1WLPEalMqWqaqNrZ1trZxdLvN14y3byrxwherdtZ1XaxtLGHuSzjLC+OTi7hnXzvLusHj0SlYs20F33kXraMbis6+bsynebBm3AruvQrN0bochUqsmFH3LeGsJ96VaJmq4LemwbIV/O3s8YsV/NXsbQ1OwGPePQ3X/Ov1g52A11gneGqyJbQVPHe0HtYJfqseLP8qeM0Wp/2vwFP1a1imK6CUqhOWWAElVQuWrSBQWrP3YZmugG9VCZatIFBD8WDZCgK1VN8Smq6AUooGy1YQqKlosAQKqKn4ltA7tYFaut81B+Cq7h/gB3CVYAFpCBaQhmABaQgWkIZgAWkIFpCGYAFpCBaQhmABaQgWkIZgAWkIFpCGYAFpCBaQhmABaQgWkMb/q01QfjAwlXAAAAAASUVORK5CYII=';
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
