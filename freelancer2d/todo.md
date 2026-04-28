Freelancer 2D - Master Prompt
- Handelsrouten Verbindungen über Trade_Lane_Ring. Das sind verbindungen (handelsrouten) die ein schiff nutzen kann um schneller von A nach B zu kommen
- Erstellung einer 2D Map die man auch vergrößern kann. Anzeige von wichtigen punkten. 
- Steuerung: 
+ Linke Maustaste gedrückt halten: Raumschiff drehen.
+ keine maustaste gedrückt: Man kann die Maus als Mauszeiger benutzen
+ Rechtemaustaste: Waffen benutzen, gedrückt halten feuert durchgehend. Einmal drücken: Feuert nur einmal.
+ Freiflug Modus: User kann das schiff frei bewegen.
+ Anliegen modus: User kann objekt anklicken, das wird dann auch selektiert und kann dann "anliegen" drücken. Dann fliegt das schiff per autopilot selbst zum ziel. Wenn der user nun mit der linken maustaste die steuerung wieder übernimmt, kann der user das schiff solange steuern aber wenn er die maus wieder los lässt dann fliegt das schiff weiter zum "Anfliegen" OBjekt.
+ Andocken: User klickt auf Objekt und klickt andocken. Dann fliegt das schiff zum ziel und dockt automatisch an.
- Schiffe: 
+ Schiffe haben ein Schutzschild welches blau um das schiff angezeigt wird.
+ Schiffe haben Panzerung (rot), wenn diese zerstört ist, explodiert das schiff.
+ Energie: Schiffe haben einen Powerplant. Dieser generiert X Energie pro sekunde. Beim schießen wird die energie geringer und läd sich dann aber wieder auf.

--------------------------------------------
-2D Objekte. Schau dir im FLAtlas Projekt die 3D Objekt Klassen an, und erstelle von CMP dateien 2D Top view screenshots die wir als Objekte in unserem spiel nutzen können. Das Projekt liegt hier: C:\Users\steve\Github\FLAtlas. Ich will stationen und schiffe haben. der user soll dann an stationen schiffe kaufen können. Übernimm bitte alle Schiffe die unter C:\Users\steve\Github\FL-Installationen\Freelancer-HD\DATA\SHIPS liegen. Mach von den Objekten dort nutzbare top view bilder, die wir als schiffe in unserem Spiel nutzen können. Das Startschiff soll dieses sein: C:\Users\steve\Github\FL-Installationen\Freelancer-HD\DATA\SHIPS\CIVILIAN\CV_STARFLIER

--------------------------

- Trade_Lane_Ring: Check die Freelancer ini dateien nochmal nach trade lane rings und setzte sie ins spiel ein. Am besten du erstellst dir einen skript welches benötigte objekte aus den spieldateien zieht, damit wir später einfach viele systeme umsetzen können.
- Wolken und Asteroidenfelder: Zieh dir auch aus den ini dateien die asteroiden felder und nebel und finde einen weg diese gut im spiel darzustellen
- sprungverbindungen in andere Systeme: Sprungtore sollen als solche erkennbar sein (3D Objekt aus Freelancer : C:\Users\steve\Github\FL-Installationen\Freelancer-HD\DATA\SOLAR\DOCKABLE\jump_gatel.cmp
- beim zoom in und zoom out soll das spielerschiff kleiner, bzw. größer werden
- universe view: die map soll zwei stufen haben: system view und universe view. die universe view soll die sternen systeme anzeigen und deren verbindungen. Hole dir bitte alle systeme rein aus C:\Users\steve\Github\FL-Installationen\Freelancer-HD\DATA\UNIVERSE. in dem ordner systems sind alle systeme. in der universe.ini sind alle systeme eingetragen, hier kannst du die koordinaten der systeme nehmen um diese in der universe view anzuzeigen

System Koordinaten:
[system]
nickname = Br02
file = systems\Br02\Br02.ini
pos = 4, 10
msg_id_prefix = gcs_refer_system_Br02
visit = 0
strid_name = 196615
ids_info = 66102

Nutze hier die pos key um die position des systems in der universe map darzustellen.

Trade Lane Ring sind diese:
[Object]
nickname = Br04_Trade_Lane_Ring_1
ids_name = 60245
pos = 11224, 0, 40474
rotate = 0, 169, 0
archetype = Trade_Lane_Ring
next_ring = Br04_Trade_Lane_Ring_2
ids_info = 66170
reputation = br_p_grp
tradelane_space_name = 196675
behavior = NOTHING
difficulty_level = 7
loadout = trade_lane_ring_br_02
pilot = pilot_solar_easiest

Nutze hier die archetype key um diese zu erstellen.

Sprunglöcher sind diese:
[Object]
nickname = Br04_to_Br06_hole
ids_name = 260675
pos = -48372, 0, -64467
rotate = 0, -90, 0
archetype = jumphole_red
msg_id_prefix = gcs_refer_system_Br06
jump_effect = jump_effect_hole
ids_info = 66146
visit = 0
goto = Br06, Br06_to_Br04_hole, gate_tunnel_bretonia
Nutze die goto variable um zu erkennen wohin das sprungloch führt. auf der gegenseite im zielsystem gibt es immer ein sprungloch was zurück führt.

Sprungtore sind diese:
[Object]
nickname = Br04_to_Br01
ids_name = 260671
pos = 1321, 0, 89533
rotate = 0, -10, 0
archetype = jumpgate
msg_id_prefix = gcs_refer_system_Br01
jump_effect = jump_effect_bretonia
ids_info = 66145
reputation = br_p_grp
behavior = NOTHING
difficulty_level = 6
goto = Br01, Br01_to_Br04, gate_tunnel_bretonia
loadout = jumpgate_br_01
pilot = pilot_solar_hardest

----------------------------------------------------------

- das spieler schiff ist aktuell nicht sichtbar und man kann auch nicht mehr rumfliegen. Hat das was mit den 2D geparsten 3D objekten zu tun?
- Handelsrouten erkennungs fix: Guck dir in FL Atlas an, wie dort Trade_Lane_Ring objekte erkannt uns als einzelne handelsroute erkannt werden. 

Implementiere den id parser:
- objekte haben ids_name und ids_info einträge. Dazu gehören dll dateien die in der freelancer.ini stehen. Lese diese Daten aus und benenne die objekte im spiel genau so wie sie im ids_name stehen. Für systeme und basen gibt es noch strid_name. unter ids_info gibt es Infocard einträge, bau diese auch ins spiel ein.

-----------------------------------------------------------














































