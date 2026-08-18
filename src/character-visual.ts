import * as THREE from 'three';

export type CharacterArchetype='normal'|'heavy'|'runner'|'knight'|'ranged'|'boss';
export type EquipmentType='sword'|'shield'|'spear'|'staff'|'none';

export type CharacterDefinition={
  archetype:CharacterArchetype;
  headScale:number;
  bodyScale:THREE.Vector3;
  armScale:number;
  legScale:number;
  height:number;
  width:number;
  equipment:EquipmentType;
  primaryColor:number;
  secondaryColor:number;
  accentColor:number;
  animationSpeed:number;
  stride:number;
  lean:number;
  shoulderScale:number;
  crestScale:number;
};

export type CharacterPose={
  x:number;
  z:number;
  facing:number;
  moving:boolean;
  spawn:number;
  attack:number;
  hit:number;
  phase:number;
  archetype:CharacterArchetype;
};

type DeathPose=CharacterPose&{life:number;vx:number;vz:number};
type Part={node:THREE.Object3D;mesh:THREE.InstancedMesh;outline?:THREE.InstancedMesh;color:'primary'|'secondary'|'skin'|'dark'|'metal'|'accent'};

export const NORMAL_CHARACTER:CharacterDefinition={
  archetype:'normal',headScale:1.12,bodyScale:new THREE.Vector3(1.03,.95,.86),armScale:1.04,legScale:1.02,
  height:1.16,width:1.1,equipment:'sword',primaryColor:0x4f8dff,secondaryColor:0x245bd6,accentColor:0x9cffff,
  animationSpeed:10.5,stride:.72,lean:.08,shoulderScale:.5,crestScale:0
};

export const HEAVY_CHARACTER:CharacterDefinition={
  archetype:'heavy',headScale:1.02,bodyScale:new THREE.Vector3(1.28,1.02,1.08),armScale:1.32,legScale:.9,
  height:1.04,width:1.24,equipment:'none',primaryColor:0x245de0,secondaryColor:0x142f82,accentColor:0xffd36b,
  animationSpeed:7.2,stride:.5,lean:.035,shoulderScale:1.55,crestScale:0
};

export const RUNNER_CHARACTER:CharacterDefinition={
  archetype:'runner',headScale:1,bodyScale:new THREE.Vector3(.82,.88,.72),armScale:.9,legScale:1.28,
  height:1.2,width:.84,equipment:'sword',primaryColor:0x39c9ff,secondaryColor:0x176eae,accentColor:0xbaffff,
  animationSpeed:14,stride:1.02,lean:.2,shoulderScale:.2,crestScale:.12
};

export const KNIGHT_CHARACTER:CharacterDefinition={
  archetype:'knight',headScale:1.08,bodyScale:new THREE.Vector3(1.15,1.02,.96),armScale:1.15,legScale:1,
  height:1.17,width:1.17,equipment:'sword',primaryColor:0x315ee8,secondaryColor:0xb8d1ff,accentColor:0xffe07d,
  animationSpeed:8.3,stride:.56,lean:.045,shoulderScale:1.12,crestScale:1
};

export const RANGED_CHARACTER:CharacterDefinition={
  archetype:'ranged',headScale:1.02,bodyScale:new THREE.Vector3(.82,1.02,.75),armScale:1.08,legScale:1.15,
  height:1.22,width:.9,equipment:'none',primaryColor:0x796dff,secondaryColor:0x31329b,accentColor:0x78fff2,
  animationSpeed:9.4,stride:.62,lean:.09,shoulderScale:.32,crestScale:.38
};

export const CHARACTER_DEFINITIONS=[NORMAL_CHARACTER,HEAVY_CHARACTER,RUNNER_CHARACTER,KNIGHT_CHARACTER,RANGED_CHARACTER] as const;

function toonGradient(){
  const data=new Uint8Array([55,55,55,145,145,145,215,215,215,255,255,255]);
  const texture=new THREE.DataTexture(data,4,1,THREE.RedFormat);
  texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
  return texture;
}

function toonMaterial(color:number,gradient:THREE.Texture,emissive=0){
  return new THREE.MeshToonMaterial({color,gradientMap:gradient,emissive,emissiveIntensity:emissive?0.68:0});
}

export class ProceduralCharacterRenderer{
  private readonly root=new THREE.Object3D();
  private readonly body=new THREE.Object3D();
  private readonly head=new THREE.Object3D();
  private readonly leftArmPivot=new THREE.Object3D();
  private readonly rightArmPivot=new THREE.Object3D();
  private readonly leftLegPivot=new THREE.Object3D();
  private readonly rightLegPivot=new THREE.Object3D();
  private readonly equipmentRoot=new THREE.Object3D();
  private readonly trailNode=new THREE.Object3D();
  private readonly leftShoulder=new THREE.Object3D();
  private readonly rightShoulder=new THREE.Object3D();
  private readonly crest=new THREE.Object3D();
  private readonly parts:Part[]=[];
  private readonly shadow:THREE.InstancedMesh;
  private readonly swordTrail:THREE.InstancedMesh;
  private readonly definitions:Record<CharacterArchetype,CharacterDefinition>;
  private readonly palettes:Record<CharacterArchetype,Record<Part['color'],THREE.Color>>;
  private readonly white=new THREE.Color(0xffffff);
  private readonly deaths:DeathPose[]=[];
  private readonly shadowDummy=new THREE.Object3D();
  private readonly trailDummy=new THREE.Object3D();
  private readonly outlineMatrix=new THREE.Matrix4();
  private readonly outlineScale=new THREE.Vector3(1.065,1.065,1.065);
  private visible=true;

  constructor(scene:THREE.Object3D,private readonly maxCount:number,definitions:readonly CharacterDefinition[]){
    const definition=definitions[0]??NORMAL_CHARACTER;
    this.definitions={normal:NORMAL_CHARACTER,heavy:HEAVY_CHARACTER,runner:RUNNER_CHARACTER,knight:KNIGHT_CHARACTER,ranged:RANGED_CHARACTER,boss:definition};
    for(const item of definitions)this.definitions[item.archetype]=item;
    const makePalette=(item:CharacterDefinition)=>({primary:new THREE.Color(item.primaryColor),secondary:new THREE.Color(item.secondaryColor),skin:new THREE.Color(0xf5c7a4),dark:new THREE.Color(0x10172c),metal:new THREE.Color(0xdbe8ff),accent:new THREE.Color(item.accentColor)});
    this.palettes={normal:makePalette(this.definitions.normal),heavy:makePalette(this.definitions.heavy),runner:makePalette(this.definitions.runner),knight:makePalette(this.definitions.knight),ranged:makePalette(this.definitions.ranged),boss:makePalette(this.definitions.boss)};
    const gradient=toonGradient();
    const materials={
      primary:toonMaterial(0xffffff,gradient,0x071a55),secondary:toonMaterial(0xffffff,gradient),
      skin:toonMaterial(0xffffff,gradient),dark:toonMaterial(0xffffff,gradient),metal:toonMaterial(0xffffff,gradient),
      accent:toonMaterial(0xffffff,gradient,0x184050)
    };
    this.root.add(this.body,this.head,this.leftArmPivot,this.rightArmPivot,this.leftLegPivot,this.rightLegPivot);
    this.rightArmPivot.add(this.equipmentRoot);this.equipmentRoot.add(this.trailNode);
    const add=(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline=false)=>{
      const mesh=new THREE.InstancedMesh(geometry,materials[color],maxCount);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;
      let outlineMesh:THREE.InstancedMesh|undefined;
      if(outline){outlineMesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0x081126,side:THREE.BackSide}),maxCount);outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);outlineMesh.frustumCulled=false;scene.add(outlineMesh)}
      scene.add(mesh);this.parts.push({node,mesh,outline:outlineMesh,color});
    };
    add(this.body,new THREE.CapsuleGeometry(.29,.38,4,8),'primary',true);
    const belt=new THREE.Object3D();belt.position.y=-.14;this.body.add(belt);add(belt,new THREE.CylinderGeometry(.31,.31,.11,10),'dark');
    const chest=new THREE.Object3D();chest.position.set(0,.12,.255);this.body.add(chest);add(chest,new THREE.BoxGeometry(.39,.2,.08),'secondary');
    add(this.head,new THREE.SphereGeometry(.285,10,7),'skin',true);
    const helmet=new THREE.Object3D();helmet.position.y=.085;this.head.add(helmet);add(helmet,new THREE.SphereGeometry(.31,10,7,0,Math.PI*2,0,Math.PI*.58),'primary',true);
    const brim=new THREE.Object3D();brim.position.set(0,.03,.03);this.head.add(brim);add(brim,new THREE.CylinderGeometry(.345,.345,.075,10),'secondary');
    const visor=new THREE.Object3D();visor.position.set(0,-.005,.272);this.head.add(visor);add(visor,new THREE.BoxGeometry(.31,.075,.055),'dark');
    this.crest.position.set(0,.36,-.015);this.head.add(this.crest);add(this.crest,new THREE.ConeGeometry(.105,.42,5),'accent',true);
    this.makeArm(this.leftArmPivot,-1,add);this.makeArm(this.rightArmPivot,1,add);
    this.makeLeg(this.leftLegPivot,-1,add);this.makeLeg(this.rightLegPivot,1,add);
    this.leftShoulder.position.set(-.37,.16,0);this.rightShoulder.position.set(.37,.16,0);this.body.add(this.leftShoulder,this.rightShoulder);
    add(this.leftShoulder,new THREE.SphereGeometry(.15,7,5),'secondary',true);add(this.rightShoulder,new THREE.SphereGeometry(.15,7,5),'secondary',true);
    const guard=new THREE.Object3D();guard.position.set(0,-.51,.11);this.equipmentRoot.add(guard);add(guard,new THREE.BoxGeometry(.31,.07,.08),'accent');
    const blade=new THREE.Object3D();blade.position.set(0,-.73,.16);blade.rotation.x=-.18;this.equipmentRoot.add(blade);add(blade,new THREE.BoxGeometry(.075,.52,.075),'metal',true);
    this.shadow=new THREE.InstancedMesh(new THREE.CircleGeometry(.38,14),new THREE.MeshBasicMaterial({color:0x071020,transparent:true,opacity:.28,depthWrite:false}),maxCount);
    this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.shadow.frustumCulled=false;scene.add(this.shadow);
    this.swordTrail=new THREE.InstancedMesh(new THREE.TorusGeometry(.46,.055,4,18,Math.PI*.86),new THREE.MeshBasicMaterial({color:0x8defff,transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),maxCount);
    this.swordTrail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.swordTrail.frustumCulled=false;scene.add(this.swordTrail);
  }

  private makeArm(pivot:THREE.Object3D,side:number,add:(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline?:boolean)=>void){
    pivot.position.set(side*.32,.17,0);const arm=new THREE.Object3D();arm.position.y=-.2;pivot.add(arm);add(arm,new THREE.CapsuleGeometry(.095,.24,3,6),'secondary');
    const hand=new THREE.Object3D();hand.position.y=-.44;pivot.add(hand);add(hand,new THREE.SphereGeometry(.115,7,5),'skin');
  }

  private makeLeg(pivot:THREE.Object3D,side:number,add:(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline?:boolean)=>void){
    pivot.position.set(side*.14,-.31,0);const leg=new THREE.Object3D();leg.position.y=-.19;pivot.add(leg);add(leg,new THREE.CapsuleGeometry(.105,.2,3,6),'dark');
    const foot=new THREE.Object3D();foot.position.set(0,-.4,.085);pivot.add(foot);add(foot,new THREE.BoxGeometry(.19,.13,.3),'secondary');
  }

  setVisible(visible:boolean){this.visible=visible;for(const p of this.parts){p.mesh.visible=visible;if(p.outline)p.outline.visible=visible}this.shadow.visible=visible;this.swordTrail.visible=visible}

  spawnDeath(pose:CharacterPose){if(!this.visible)return;if(this.deaths.length>=32)this.deaths.shift();this.deaths.push({...pose,life:.58,vx:-Math.sin(pose.facing)*1.4,vz:-Math.cos(pose.facing)*1.4})}

  sync(poses:CharacterPose[],poseCount:number,time:number,dt:number){
    for(let i=this.deaths.length-1;i>=0;i--){const d=this.deaths[i];d.life-=dt;d.x+=d.vx*dt;d.z+=d.vz*dt;if(d.life<=0)this.deaths.splice(i,1)}
    const total=Math.min(this.maxCount,poseCount+this.deaths.length);
    let trailCount=0;
    for(let i=0;i<total;i++){
      const deathPose=i>=poseCount?this.deaths[i-poseCount]:null,pose=deathPose??poses[i],death=deathPose?1-deathPose.life/.58:0;
      const definition=this.definitions[pose.archetype]??NORMAL_CHARACTER,palette=this.palettes[pose.archetype]??this.palettes.normal;
      const speed=pose.moving?1:0,animTime=time*definition.animationSpeed+pose.phase,run=Math.sin(animTime)*speed,bounce=speed*Math.abs(Math.sin(animTime))*(definition.archetype==='heavy'?.04:.065)+Math.sin(time*2.4+pose.phase)*.012;
      const attackT=pose.attack>0?1-pose.attack/.18:0,attack=Math.sin(Math.max(0,Math.min(1,attackT))*Math.PI),hit=Math.min(1,pose.hit*7);
      const spawnScale=pose.spawn>0?.75+Math.sin((.5-pose.spawn)/.5*Math.PI)*.25:1,deathScale=1-death*.46;
      this.root.position.set(pose.x-Math.sin(pose.facing)*hit*.18,.92+bounce+death*.08,pose.z-Math.cos(pose.facing)*hit*.18);
      this.root.rotation.set(-definition.lean*speed,pose.facing,death*1.2);const baseScale=spawnScale*deathScale;this.root.scale.set(definition.width*baseScale,definition.height*baseScale,definition.width*baseScale);
      this.body.scale.copy(definition.bodyScale);this.body.rotation.z=Math.sin(time*2.4+pose.phase)*(definition.archetype==='heavy'?.014:.025);
      this.head.position.set(0,.48+(definition.legScale-1)*.04,0);this.head.scale.setScalar(definition.headScale);this.head.rotation.y=Math.sin(time*1.7+pose.phase)*.045;
      this.leftArmPivot.scale.setScalar(definition.armScale);this.rightArmPivot.scale.setScalar(definition.armScale);this.leftLegPivot.scale.setScalar(definition.legScale);this.rightLegPivot.scale.setScalar(definition.legScale);
      const armSwing=run*definition.stride,legSwing=run*definition.stride*.94;
      this.leftArmPivot.rotation.set(armSwing,0,-.08);this.rightArmPivot.rotation.set(-armSwing-attack*1.72,0,.08+attack*.48);
      this.leftLegPivot.rotation.set(-legSwing,0,0);this.rightLegPivot.rotation.set(legSwing,0,0);
      if(definition.archetype==='heavy'){this.leftArmPivot.rotation.z=-.25;this.rightArmPivot.rotation.z=.25+attack*.35}
      if(definition.archetype==='knight'){this.leftArmPivot.rotation.z=-.16;this.rightArmPivot.rotation.z=.16+attack*.42}
      if(definition.archetype==='ranged'){this.leftArmPivot.rotation.x=-.45+run*.34;this.leftArmPivot.rotation.z=-.16;this.rightArmPivot.rotation.x=.42-run*.34;this.rightArmPivot.rotation.z=.16}
      this.leftShoulder.scale.setScalar(definition.shoulderScale);this.rightShoulder.scale.setScalar(definition.shoulderScale);this.crest.scale.set(definition.crestScale,definition.crestScale,definition.crestScale);
      const hasSword=definition.equipment==='sword';this.equipmentRoot.scale.setScalar(hasSword?1:0);this.equipmentRoot.rotation.set(-attack*.45,0,attack*.25);this.trailNode.position.set(0,-.5,.14);
      this.root.updateMatrixWorld(true);
      for(const part of this.parts){part.mesh.setMatrixAt(i,part.node.matrixWorld);part.mesh.setColorAt(i,pose.hit>0?this.white:palette[part.color]);if(part.outline){this.outlineMatrix.copy(part.node.matrixWorld).scale(this.outlineScale);part.outline.setMatrixAt(i,this.outlineMatrix)}}
      this.shadowDummy.position.set(pose.x,.015,pose.z);this.shadowDummy.rotation.set(-Math.PI/2,0,0);this.shadowDummy.scale.set(1-death*.5,.62-death*.3,1);this.shadowDummy.updateMatrix();this.shadow.setMatrixAt(i,this.shadowDummy.matrix);
      if(pose.attack>0&&!death&&hasSword){this.trailDummy.position.set(pose.x+Math.sin(pose.facing)*.33,1.04,pose.z+Math.cos(pose.facing)*.33);this.trailDummy.rotation.set(Math.PI/2,pose.facing,-.65+attackT*1.3);this.trailDummy.scale.setScalar(.8+attack*.25);this.trailDummy.updateMatrix();this.swordTrail.setMatrixAt(trailCount++,this.trailDummy.matrix)}
    }
    for(const part of this.parts){part.mesh.count=total;part.mesh.instanceMatrix.needsUpdate=true;if(part.mesh.instanceColor)part.mesh.instanceColor.needsUpdate=true;if(part.outline){part.outline.count=total;part.outline.instanceMatrix.needsUpdate=true}}
    this.shadow.count=total;this.shadow.instanceMatrix.needsUpdate=true;this.swordTrail.count=trailCount;this.swordTrail.instanceMatrix.needsUpdate=true;
  }
}

