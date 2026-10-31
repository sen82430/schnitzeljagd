// =====================================================
//  SPIEL-INHALT: Orte, Missionen, Texte
//  (wird von Claude angepasst, wenn du Änderungen willst)
// =====================================================
window.GAME = {
  start: {lat:47.173829, lng:8.108621, name:'Start'},
  end:   {lat:47.174003, lng:8.108918, name:'Endpunkt', task:'Sucht die Schokobananen! 🍫🍌'},
  missions: [
    {name:"McDonald's", lat:47.177712, lng:8.1102747, proof:'Foto',
      task:"Macht ein Selfie mit der ganzen Gruppe vor der McDonald's-Kasse.", short:"Selfie vor der McDonald's-Kasse"},
    {name:'Bei den Vögeln', lat:47.175362, lng:8.113924, proof:'Video',
      task:'Macht bei den Vögeln ein 30-Sekunden-Video, in dem ihr Vogelgeräusche nachahmt.', short:'30-Sek-Video Vogelgeräusche'},
    {name:'Kapelle Mariazell', lat:47.173283, lng:8.1198751, proof:'Foto',
      task:'Legt das JW-Logo aus Naturmaterialien und fotografiert es.', short:'JW-Logo aus Naturmaterialien'},
    {name:'GOAT', lat:47.172758, lng:8.122087, proof:'Foto',
      task:'Macht ein Foto mit einem GOAT aus Sursee.', short:'Foto mit einem GOAT aus Sursee'},
    {name:'Sprint-Duell', lat:47.1726134, lng:8.1101605, lat2:47.172012, lng2:8.11045, finishName:'Bäckerei Hänggi', proof:'Video',
      task:'Sprint-Duell vom Stadtcafé (Start) bis zur Bäckerei Hänggi (Ziel). Filmt das Rennen!', short:'Sprint Stadtcafé → Bäckerei Hänggi'}
  ]
};
