#!/usr/bin/env python3
"""Zoo evidence collector. Uses GitHub API, never invents worker activity."""
import datetime,json,os,urllib.request,urllib.error
from pathlib import Path
repo=os.environ.get("ZOO_REPO","london4216-hue/Zoodo")
token=os.environ.get("GITHUB_TOKEN","")
now=datetime.datetime.now(datetime.timezone.utc)
def get(path):
    req=urllib.request.Request("https://api.github.com/repos/"+repo+"/"+path,headers={"Accept":"application/vnd.github+json","User-Agent":"zoo-evidence/1.0",**({"Authorization":"Bearer "+token} if token else {})})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return json.load(r),None
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:return None,str(e)
def snapshot():
    data={"schema":1,"repository":repo,"collected_at":now.isoformat(),"verification":"UNVERIFIED","checks":{},"failures":[]}
    for label,path in [("workflow_runs","actions/runs?per_page=30"),("pull_requests","pulls?state=open&per_page=30"),("commits","commits?per_page=20")]:
        result,error=get(path)
        if error:
            data["checks"][label]={"status":"UNKNOWN","reason":error}
            data["failures"].append(label+": "+error)
            continue
        items=result.get("workflow_runs",[]) if label=="workflow_runs" else result
        data["checks"][label]={"status":"OBSERVED","count":len(items)}
        if label=="workflow_runs":
            data["checks"][label]["latest"]=[{"id":x.get("id"),"name":x.get("name"),"status":x.get("status"),"conclusion":x.get("conclusion"),"created_at":x.get("created_at"),"updated_at":x.get("updated_at"),"url":x.get("html_url")} for x in items[:15]]
        elif label=="pull_requests":
            data["checks"][label]["latest"]=[{"number":x.get("number"),"title":x.get("title"),"updated_at":x.get("updated_at"),"url":x.get("html_url")} for x in items[:15]]
        else:
            data["checks"][label]["latest"]=[{"sha":x.get("sha"),"date":x.get("commit",{}).get("committer",{}).get("date"),"url":x.get("html_url")} for x in items[:15]]
    if not data["failures"]:data["verification"]="GITHUB_OBSERVED"
    data["agent_fleet"]="UNVERIFIED" # GitHub activity does not prove provider workers are alive
    data["dispatch_latency"]="UNKNOWN"
    data["failure_reassignment_latency"]="UNKNOWN"
    return data
if __name__=="__main__":
    out=Path(os.environ.get("ZOO_EVIDENCE_OUT","engine/dashboard/evidence.json"))
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(snapshot(),indent=2)+"\n")
    print("Evidence written:",out)
